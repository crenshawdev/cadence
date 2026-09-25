use crate::{config::reload::ConfigIo, import::SessionFactory};
use cadence::{envelope::Refusal, spike::model::{self, Apply}, store::{Error, Result, writer::Operation}};
use serde_json::Value;
use std::path::Path;

pub enum Command { Apply(Apply) }

pub async fn execute<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, command: Command) -> Result<Value> {
    Ok(match execute_inner(factory, root, command).await {
        Ok(answer) => answer,
        Err(error) => Refusal::new("spike-unavailable", error.to_string()).slot("request").value(),
    })
}
async fn execute_inner<I: ConfigIo + Clone + Sync>(factory: &SessionFactory<I>, root: &Path, command: Command) -> Result<Value> {
    let Command::Apply(apply) = command;
    let session = factory.first_touch(root).await?;
    let store = session.review_store();
    let view = store.request(Operation::ReadVerified).await?;
    let project = root.canonicalize()?.parent().ok_or_else(|| Error::Invalid("planning root lacks project".into()))?.to_path_buf();
    let write = model::Write { root_binding: cadence::verification::inputs::root_binding(root)?, project, apply };
    if let Some(answer) = model::replay(&view.snapshot.data, &write)? { return Ok(answer); }
    cadence::milestone::model::name(write.apply.identity().0)?;
    if let Apply::Open { request } = &write.apply {
        model::validate_slug(&request.slug)?;
        if !model::namespace(&view.snapshot.data)?.records.contains_key(&request.slug)
            && root.join("spikes").join(&request.slug).try_exists()? {
            return Ok(Refusal::new("spike-history", "existing spike directories are history and cannot become native records").slot("request.slug").value());
        }
    }
    if let Apply::Close { request } = &write.apply {
        model::external_location(&write.project, &request.throwaway_location)?;
        // Resolve existing aliases while the experiment is present. The saved
        // location remains evidence after the host discards the experiment.
        let mut ancestor = Path::new(&request.throwaway_location);
        while !ancestor.try_exists()? {
            ancestor = ancestor.parent().ok_or_else(|| Error::Invalid("throwaway location has no existing ancestor".into()))?;
        }
        let resolved = ancestor.canonicalize()?.join(Path::new(&request.throwaway_location).strip_prefix(ancestor)
            .map_err(|e| Error::Invalid(e.to_string()))?);
        model::external_location(&write.project, resolved.to_str().ok_or_else(|| Error::Invalid("non-UTF-8 throwaway location".into()))?)?;
    }
    let response = model::outcome(&view.snapshot.data, &write).map(|record| model::answer(&record)).unwrap_or_else(|refusal| refusal);
    store.request(Operation::SpikeV1 { expected_generation: view.snapshot.generation,
        expected_integrity: view.snapshot.integrity.clone(), write: Box::new(write) }).await?;
    Ok(response)
}
