use super::{consent, Approval, Jobs};
use crate::{
    adapters::github_app::sqlite::{self, target::Target, AppResource},
    domain::Connection,
    error::{AppError, AppResult},
    transaction::Resource,
};
use chrono::Utc;
use std::sync::atomic::Ordering;
use uuid::Uuid;

/// Authority held only by the confirmed, in-progress publication. The durable
/// record reserves recovery before writing and grants background sync on success.
pub(crate) struct PublicationGrant {
    reviewed: Approval,
    reserved_revision: String,
    connection_id: String,
}

impl Jobs {
    pub(super) fn publication_approval(&self, connection: &Connection) -> AppResult<Approval> {
        let epoch = self.settings_epoch.load(Ordering::Acquire);
        let mode = self.snapshot()?;
        if !mode.enabled {
            return Err(AppError::PlanChanged);
        }
        let target = publication_target(&mode)?;
        let needs_grant = mode.approve(connection, &target).is_err();
        if needs_grant {
            check_recovery_target(&mode, &target)?;
        }
        if !self.same_settings_epoch(epoch) {
            return Err(AppError::PlanChanged);
        }
        Ok(Approval {
            target,
            consent_revision: mode.revision()?,
            revoke: false,
            grant_epoch: needs_grant.then_some(epoch),
        })
    }

    pub(crate) fn reserve_publication(
        &self,
        connection: &Connection,
        approval: &Approval,
    ) -> AppResult<PublicationGrant> {
        let epoch = approval.grant_epoch.ok_or(AppError::PlanChanged)?;
        let mut store = self.mode.lock().map_err(|_| AppError::Lock)?;
        let mut mode = store.snapshot()?;
        if approval.revoke
            || !mode.enabled
            || mode.revision()? != approval.consent_revision
            || !self.same_settings_epoch(epoch)
        {
            return Err(AppError::PlanChanged);
        }
        check_recovery_target(&mode, &approval.target)?;
        if !mode
            .target
            .as_ref()
            .is_some_and(|target| target.same_scope(&approval.target))
        {
            mode.scopes.clear();
            mode.granted_at = None;
        }
        mode.target = Some(approval.target.clone());
        mode.recovery_ids.insert(connection.id.clone());
        mode.validate(&self.owner)?;
        let reserved_revision = mode.revision()?;
        if reserved_revision != approval.consent_revision {
            store.save(mode)?;
        }
        Ok(PublicationGrant {
            reviewed: approval.clone(),
            reserved_revision,
            connection_id: connection.id.clone(),
        })
    }

    pub(crate) fn authorize_publication(
        &self,
        connection: &Connection,
        resource: &Resource,
        grant: Option<&PublicationGrant>,
    ) -> AppResult<()> {
        let (Some(grant), Resource::AppSqlite(resource)) = (grant, resource) else {
            return self.authorize(connection, resource);
        };
        self.check_publication_grant(grant, connection, resource)
    }

    fn check_publication_grant(
        &self,
        grant: &PublicationGrant,
        connection: &Connection,
        resource: &AppResource,
    ) -> AppResult<()> {
        if resource.revoke
            || resource.owner_id != self.owner
            || resource.connection_id != grant.connection_id
            || resource.connection_id != connection.id
            || resource.target != grant.reviewed.target
            || resource.consent_revision != grant.reviewed.consent_revision
            || !grant
                .reviewed
                .grant_epoch
                .is_some_and(|epoch| self.same_settings_epoch(epoch))
            || self.snapshot()?.revision()? != grant.reserved_revision
        {
            return Err(AppError::PlanChanged);
        }
        Ok(())
    }

    pub(crate) fn commit_publication_scope(
        &self,
        connection: &Connection,
        grant: &PublicationGrant,
    ) -> AppResult<()> {
        let epoch = grant.reviewed.grant_epoch.ok_or(AppError::PlanChanged)?;
        let mut store = self.mode.lock().map_err(|_| AppError::Lock)?;
        let mut mode = store.snapshot()?;
        if !self.same_settings_epoch(epoch)
            || connection.id != grant.connection_id
            || mode.revision()? != grant.reserved_revision
        {
            return Err(AppError::PlanChanged);
        }
        mode.scopes
            .insert(connection.id.clone(), consent::destination(connection)?);
        mode.granted_at = Some(Utc::now());
        mode.nonce = Uuid::new_v4().to_string();
        store.save(mode)?;
        self.cancelled.store(false, Ordering::Release);
        if !self.same_settings_epoch(epoch) {
            self.cancelled.store(true, Ordering::Release);
        }
        Ok(())
    }

    fn same_settings_epoch(&self, epoch: u64) -> bool {
        !self.stopping.load(Ordering::Acquire)
            && self.settings_epoch.load(Ordering::Acquire) == epoch
    }
}

fn publication_target(mode: &consent::Consent) -> AppResult<Target> {
    #[cfg(test)]
    if let Some(target) = mode
        .target
        .as_ref()
        .filter(|target| target.binary.as_os_str().is_empty())
    {
        return target.refreshed();
    }
    let _ = mode;
    sqlite::target::review()
}

fn check_recovery_target(mode: &consent::Consent, target: &Target) -> AppResult<()> {
    if !mode.recovery_ids.is_empty()
        && mode
            .target
            .as_ref()
            .is_some_and(|old| !old.same_store(target))
    {
        return Err(AppError::AppScopeChanged);
    }
    Ok(())
}
