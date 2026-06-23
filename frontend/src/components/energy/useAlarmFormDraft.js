import { useCallback, useEffect, useRef } from 'react';
import { EMPTY_RULE_FORM } from './energyAlarmConfig';
import {
  loadFleetAlarmDraft,
  saveFleetAlarmDraft,
  loadMeterAlarmDraft,
  saveMeterAlarmDraft,
} from './alarmFormDraft';

export function useFleetAlarmFormDraft({ form, showModal, editingRule }) {
  const draftRef = useRef({ form, showModal, editingRuleId: editingRule?._id || null });

  draftRef.current = {
    form,
    showModal,
    editingRuleId: editingRule?._id || null,
  };

  useEffect(() => {
    return () => {
      saveFleetAlarmDraft(draftRef.current);
    };
  }, []);

  const persistNow = useCallback((patch = {}) => {
    const next = {
      form: patch.form ?? draftRef.current.form,
      showModal: patch.showModal ?? draftRef.current.showModal,
      editingRuleId:
        patch.editingRuleId !== undefined
          ? patch.editingRuleId
          : draftRef.current.editingRuleId,
    };
    saveFleetAlarmDraft(next);
    draftRef.current = next;
  }, []);

  return { persistNow };
}

export function useMeterAlarmFormDraft(meterId, { form, showModal, editingRule }) {
  const draftRef = useRef({ form, showModal, editingRuleId: editingRule?._id || null });

  draftRef.current = {
    form,
    showModal,
    editingRuleId: editingRule?._id || null,
  };

  useEffect(() => {
    return () => {
      if (meterId) saveMeterAlarmDraft(meterId, draftRef.current);
    };
  }, [meterId]);

  const persistNow = useCallback(
    (patch = {}) => {
      if (!meterId) return;
      const next = {
        form: patch.form ?? draftRef.current.form,
        showModal: patch.showModal ?? draftRef.current.showModal,
        editingRuleId:
          patch.editingRuleId !== undefined
            ? patch.editingRuleId
            : draftRef.current.editingRuleId,
      };
      saveMeterAlarmDraft(meterId, next);
      draftRef.current = next;
    },
    [meterId]
  );

  return { persistNow };
}

export function getFleetDraftInitialState() {
  const draft = loadFleetAlarmDraft();
  return {
    form: draft?.form || { ...EMPTY_RULE_FORM, meterId: '' },
    showModal: draft?.showModal ?? false,
    editingRuleId: draft?.editingRuleId ?? null,
  };
}

export function getMeterDraftInitialState(meterId) {
  const draft = meterId ? loadMeterAlarmDraft(meterId) : null;
  return {
    form: draft?.form || { ...EMPTY_RULE_FORM },
    showModal: draft?.showModal ?? false,
    editingRuleId: draft?.editingRuleId ?? null,
  };
}

export function hasRestorableCreateDraft(draft) {
  if (!draft?.form) return false;
  if (draft.editingRuleId) return false;
  const f = draft.form;
  return Boolean(
    f.minThreshold ||
      f.maxThreshold ||
      f.label ||
      f.meterId ||
      f.metric !== 'voltage' ||
      f.severity !== 'warning' ||
      String(f.cooldownMinutes) !== '5'
  );
}
