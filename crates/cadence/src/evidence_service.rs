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
    /// An absent invocation flag is a read, never an inferred operator answer.
    InvokeOverride {
        requested: bool,
        operation_id: String,
        record: Box<Record>,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Recovery {
    pub current: Vec<Record>,
    pub history: Vec<Record>,
}

impl Recovery {
    /// A historical settlement answers only its recorded work and range.
    pub fn review_settlements(
        &self,
        scope: &cadence::evidence::Scope,
        base: &str,
        head: &str,
        trigger: &str,
        plan: Option<&str>,
    ) -> Vec<&Record> {
        self.history.iter().filter(|r| r.scope == *scope && matches!(&r.fact,
            cadence::evidence::Fact::Override(value) if matches!(&value.meaning,
                cadence::evidence::overrides::Meaning::Review(receipt) if receipt.settles(base, head, trigger, plan)))).collect()
    }
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
    let command = match command {
        Command::InvokeOverride {
            requested: false, ..
        } => Command::Read,
        Command::InvokeOverride {
            operation_id,
            record,
            ..
        } => {
            if !matches!(&record.fact, cadence::evidence::Fact::Override(value)
                if matches!(value.authorization, cadence::evidence::overrides::Authorization::Invocation { .. }))
            {
                return Err(Error::Invalid(
                    "explicit override invocation required".into(),
                ));
            }
            Command::Submit {
                operation_id,
                record,
            }
        }
        other => other,
    };
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
            // Replay keeps the original admitted set even if the files later change.
            let receipt = persistence::history(&operation_id, &record)?;
            if !before.decisions.iter().any(|d| d.id == receipt.id)
                && let cadence::evidence::Fact::Override(value) = &record.fact
                && let cadence::evidence::overrides::Meaning::Rerun { admitted_plans } =
                    &value.meaning
            {
                let path = root.clone();
                let phase = record.scope.phase.clone();
                let plans = tokio::task::spawn_blocking(move || {
                    let prepared = cadence::derivation::prepare_query(
                        &path,
                        &mut cadence::derivation::ArtifactFiles,
                    )
                    .map_err(|e| Error::Invalid(format!("rerun observation: {e:?}")))?;
                    prepared
                        .answer()
                        .phases
                        .iter()
                        .find(|p| p.id.number().to_string() == phase)
                        .map(|p| p.plans.clone())
                        .ok_or_else(|| Error::Invalid("rerun phase not admitted".into()))
                })
                .await
                .map_err(|_| Error::Closed)??;
                if plans.iter().collect::<std::collections::BTreeSet<_>>()
                    != admitted_plans.iter().collect()
                {
                    return Err(Error::Invalid("rerun must name all admitted plans".into()));
                }
            }
            let written = session
                .commit_evidence(&before, &operation_id, &record)
                .await?;
            recover(&written)
        }
        Command::InvokeOverride { .. } => unreachable!("normalized invocation"),
    }
}
