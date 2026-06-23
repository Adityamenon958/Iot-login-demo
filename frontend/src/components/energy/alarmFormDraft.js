import { EMPTY_RULE_FORM } from './energyAlarmConfig';

const FLEET_DRAFT_KEY = 'energyAlarmFormDraft:fleet';
const METER_DRAFT_KEY_PREFIX = 'energyAlarmFormDraft:meter:';

function readDraft(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeDraft(key, draft) {
  try {
    if (!draft) {
      sessionStorage.removeItem(key);
      return;
    }
    sessionStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // ignore quota / private mode errors
  }
}

function hasMeaningfulDraftContent(form, showModal, editingRuleId, meterId = '') {
  if (showModal || editingRuleId) return true;
  if (form.meterId && form.meterId !== meterId) return true;
  if (form.minThreshold !== '' && form.minThreshold != null) return true;
  if (form.maxThreshold !== '' && form.maxThreshold != null) return true;
  if (form.label) return true;
  if (form.metric && form.metric !== 'voltage') return true;
  if (form.severity && form.severity !== 'warning') return true;
  if (form.cooldownMinutes != null && Number(form.cooldownMinutes) !== 5) return true;
  return false;
}

export function loadFleetAlarmDraft() {
  const draft = readDraft(FLEET_DRAFT_KEY);
  if (!draft?.form) return null;
  return {
    form: { ...EMPTY_RULE_FORM, meterId: '', ...draft.form },
    showModal: Boolean(draft.showModal),
    editingRuleId: draft.editingRuleId || null,
  };
}

export function saveFleetAlarmDraft({ form, showModal, editingRuleId }) {
  const shouldKeep = hasMeaningfulDraftContent(form, showModal, editingRuleId, form.meterId);
  if (!shouldKeep) {
    writeDraft(FLEET_DRAFT_KEY, null);
    return;
  }
  writeDraft(FLEET_DRAFT_KEY, {
    form,
    showModal: Boolean(showModal),
    editingRuleId: editingRuleId || null,
  });
}

export function clearFleetAlarmDraft() {
  writeDraft(FLEET_DRAFT_KEY, null);
}

export function loadMeterAlarmDraft(meterId) {
  if (!meterId) return null;
  const draft = readDraft(`${METER_DRAFT_KEY_PREFIX}${meterId}`);
  if (!draft?.form) return null;
  return {
    form: { ...EMPTY_RULE_FORM, ...draft.form },
    showModal: Boolean(draft.showModal),
    editingRuleId: draft.editingRuleId || null,
  };
}

export function saveMeterAlarmDraft(meterId, { form, showModal, editingRuleId }) {
  if (!meterId) return;
  const shouldKeep = hasMeaningfulDraftContent(form, showModal, editingRuleId, meterId);
  if (!shouldKeep) {
    writeDraft(`${METER_DRAFT_KEY_PREFIX}${meterId}`, null);
    return;
  }
  writeDraft(`${METER_DRAFT_KEY_PREFIX}${meterId}`, {
    form,
    showModal: Boolean(showModal),
    editingRuleId: editingRuleId || null,
  });
}

export function clearMeterAlarmDraft(meterId) {
  if (!meterId) return;
  writeDraft(`${METER_DRAFT_KEY_PREFIX}${meterId}`, null);
}
