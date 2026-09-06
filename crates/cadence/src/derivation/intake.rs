use super::*;
use serde_json::{Map, Value};

fn invalid(detail: impl ToString) -> DerivationError {
    DerivationError::InvalidIntake {
        source: "data.derivation.intake".into(),
        detail: detail.to_string(),
    }
}

fn namespace(data: &Value) -> Result<Option<&Map<String, Value>>, DerivationError> {
    if !data.is_null() && !data.is_object() {
        return Err(invalid("snapshot data must be an object or fresh null"));
    }
    data.get("derivation")
        .map(|d| {
            d.as_object()
                .ok_or_else(|| invalid("data.derivation must be an object"))
        })
        .transpose()
}

fn retirement(data: &Value) -> Result<Option<IntakeRecord>, DerivationError> {
    let Some(namespace) = namespace(data)? else {
        return Ok(None);
    };
    let Some(raw) = namespace.get("intake") else {
        return Ok(None);
    };
    if !namespace.contains_key("memo") {
        return Err(invalid("retirement requires its accepted memo sibling"));
    }
    for field in [
        "version",
        "source",
        "original_cursor",
        "normalized",
        "retired",
    ] {
        if raw.get(field).is_none() {
            return Err(invalid(format!("missing {field}")));
        }
    }
    let record: IntakeRecord = serde_json::from_value(raw.clone()).map_err(invalid)?;
    if record.version != 1 || record.source != "data.cursor" || !record.retired {
        return Err(invalid("unsupported retirement version, source or marker"));
    }
    let normalized = normalize_imported_cursor(&record.original_cursor).map_err(invalid)?;
    // Validate retained semantics too: forged/malformed normalized hold data
    // cannot authorize suppression merely because the outer marker is true.
    if record.normalized != normalized
        || raw.get("normalized") != Some(&serde_json::to_value(&normalized).map_err(invalid)?)
    {
        return Err(invalid(
            "normalized provenance differs from original cursor",
        ));
    }
    Ok(Some(record))
}

/// Select only unconsumed assertions. Raw changes re-arm intake independently
/// of lifecycle hashing; malformed retirement metadata always refuses.
pub fn select_intake(data: &Value) -> Result<SelectedIntake, DerivationError> {
    let record = retirement(data)?;
    let observation = IntakeObservation::from_data(data);
    let raw = observation.cursor.as_ref().unwrap_or(&Value::Null);
    let normalized = normalize_imported_cursor(raw)?;
    let cursor = if record.as_ref().is_some_and(|r| &r.original_cursor == raw) {
        CompatibilityCursor::Unavailable(normalized.provenance().clone())
    } else {
        normalized
    };
    Ok(SelectedIntake {
        cursor,
        observation,
    })
}

/// Pure atomic snapshot transformation. The opaque accepted memo and retirement
/// are installed together; callers must await the existing writer at the edge.
pub fn adopt(
    data: &Value,
    accepted_memo: Value,
    validated_intake: &ValidatedIntake,
) -> Result<Value, DerivationError> {
    let selected = select_intake(data)?;
    recheck_intake(&validated_intake.observation, &selected.observation)?;
    if validated_intake.cursor != selected.cursor {
        return Err(invalid("intake was not validated as selected"));
    }
    let mut object = data.as_object().cloned().unwrap_or_default();
    let mut derivation = namespace(data)?.cloned().unwrap_or_default();
    let prior = retirement(data)?;
    let raw = selected.observation.cursor.unwrap_or(Value::Null);
    if !prior.as_ref().is_some_and(|r| r.original_cursor == raw) {
        let record = IntakeRecord {
            version: 1,
            source: "data.cursor".into(),
            original_cursor: raw.clone(),
            normalized: normalize_imported_cursor(&raw)?,
            retired: true,
        };
        derivation.insert(
            "intake".into(),
            serde_json::to_value(record).map_err(invalid)?,
        );
    }
    derivation.insert("memo".into(), accepted_memo);
    object.insert("derivation".into(), Value::Object(derivation));
    Ok(Value::Object(object))
}

impl RecheckedLifecycle {
    /// Production adoption accepts the freshly checked typed memo only.
    pub fn adopt_memo(&self, data: &Value, memo: &LifecycleMemo) -> Result<Value, DerivationError> {
        let raw = serde_json::to_value(memo).map_err(invalid)?;
        let key = input_key(self.capture())?;
        if check_memo(Some(&raw), &key, self.answer())? != MemoDisposition::Hit {
            return Err(DerivationError::InputsChanged);
        }
        adopt(
            data,
            raw,
            self.intake()
                .ok_or_else(|| invalid("missing validated intake"))?,
        )
    }
}
