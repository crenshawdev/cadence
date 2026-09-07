//! Internal evidence adapter. The resident invokes this directly, never itself.
use crate::{
    config::reload::{self, ConfigIo},
    import::SessionFactory,
};
use cadence::{
    evidence::{Record, persistence},
    store::{Error, Result, writer::View},
};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Clone, Debug)]
pub enum Command {
    Read,
    Submit {
        operation_id: String,
        record: Box<Record>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Recovery {
    pub current: Vec<Record>,
    pub history: Vec<Record>,
}

fn recover(view: &View) -> Result<Recovery> {
    Ok(Recovery {
        current: persistence::read(&view.snapshot.data)?
            .into_values()
            .collect(),
        history: view
            .decisions
            .iter()
            .filter_map(|decision| persistence::decode_history(decision).transpose())
            .collect::<Result<_>>()?,
    })
}

pub async fn execute<I: ConfigIo + Clone + Sync>(
    factory: &SessionFactory<I>,
    root: &Path,
    command: Command,
) -> Result<Recovery> {
    let selected = root.to_path_buf();
    let root = tokio::task::spawn_blocking(move || reload::identity(&selected))
        .await
        .map_err(|_| Error::Closed)??;
    if let Command::Submit { record, .. } = &command {
        record.validate()?;
        if Path::new(&record.scope.planning_root) != root
            || root.parent() != Some(Path::new(&record.scope.project))
        {
            return Err(Error::Invalid(
                "evidence scope does not name the selected project/planning root".into(),
            ));
        }
    }
    let session = factory.first_touch(&root).await?;
    let before = session.derivation_view().await?;
    match command {
        Command::Read => recover(&before),
        Command::Submit {
            operation_id,
            record,
        } => {
            let written = session
                .commit_evidence(&before, &operation_id, &record)
                .await?;
            recover(&written)
        }
    }
}
