import React, { useState } from 'react';
import { ArrowDown, ArrowUp, LifeBuoy, Plus, Trash2 } from 'lucide-react';
import { api, type HelpContent } from '../services/api';
import { Button, EmptyState, Field, FormError, LoadState, PageIntro, Panel, useConfirm, useToast } from './ui';

interface HelpManagerProps {
  content: HelpContent | null;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  canEdit: boolean;
  onSaved: (help: HelpContent) => void;
  onAudit?: (action: string, details: string) => void;
}

type DraftFaq = { key: string; question: string; answer: string };

type Draft = {
  phone: string;
  phoneLabel: string;
  whatsapp: string;
  email: string;
  hours: string;
  faqs: DraftFaq[];
};

let nextKey = 1;
function draftKey() {
  nextKey += 1;
  return `new-${nextKey}`;
}

function toDraft(help: HelpContent): Draft {
  return {
    phone: help.phone,
    phoneLabel: help.phoneLabel,
    whatsapp: help.whatsapp,
    email: help.email,
    hours: help.hours,
    faqs: help.faqs.map((faq) => ({ key: String(faq.id), question: faq.question, answer: faq.answer })),
  };
}

const blank = (): Draft => ({ phone: '', phoneLabel: '', whatsapp: '', email: '', hours: '', faqs: [] });

export const HelpManager: React.FC<HelpManagerProps> = ({ content, loading, loadError, onRetry, canEdit, onSaved, onAudit }) => {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<Draft>(blank);
  const [seen, setSeen] = useState<HelpContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (content && content !== seen) {
    setSeen(content);
    setDraft(toDraft(content));
  }

  const setField = (key: keyof Omit<Draft, 'faqs'>, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const setFaq = (key: string, field: 'question' | 'answer', value: string) => {
    setDraft((current) => ({
      ...current,
      faqs: current.faqs.map((faq) => (faq.key === key ? { ...faq, [field]: value } : faq)),
    }));
  };

  const moveFaq = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const next = [...current.faqs];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [row] = next.splice(index, 1);
      next.splice(target, 0, row);
      return { ...current, faqs: next };
    });
  };

  const removeFaq = async (faq: DraftFaq) => {
    const label = faq.question.trim() || 'this question';
    if (!(await confirm({ title: 'Remove question', message: `Remove "${label}" from the help page?`, confirmLabel: 'Remove', destructive: true }))) {
      return;
    }
    setDraft((current) => ({ ...current, faqs: current.faqs.filter((row) => row.key !== faq.key) }));
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const saved = await api.saveHelp({
        phone: draft.phone,
        phoneLabel: draft.phoneLabel,
        whatsapp: draft.whatsapp,
        email: draft.email,
        hours: draft.hours,
        faqs: draft.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })),
      });
      setDraft(toDraft(saved));
      onSaved(saved);
      const count = saved.faqs.length;
      onAudit?.('Saved help page', count === 0 ? 'Saved the help page with no questions yet.' : `Saved the help page with ${count} question${count === 1 ? '' : 's'}.`);
      toast.success('Help page saved. The app will show it once it reads this page.');
    } catch (err: any) {
      setFormError(err.message || 'The help page could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <PageIntro
        actions={
          canEdit ? (
            <Button onClick={() => void save()} loading={saving} disabled={loading}>
              Save help page
            </Button>
          ) : null
        }
      >
        The phone number, WhatsApp number, email, hours and questions the app shows on Help. Leave any of them blank until the wording is ready.
      </PageIntro>

      <LoadState
        loading={loading}
        error={loadError}
        what="the help page"
        onRetry={onRetry}
        isEmpty={content == null}
        empty={{ title: 'No help page yet', description: 'The page could not be read.' }}
      >
        <Panel title="How customers reach you">
          <div style={styles.grid}>
            <Field id="help-phone" label="Phone number" hint="Digits the app can dial. Leave blank for now.">
              <input value={draft.phone} disabled={!canEdit} onChange={(e) => setField('phone', e.target.value)} />
            </Field>
            <Field id="help-phone-label" label="Phone as shown" hint="How the number reads, for example 1800-120-1343.">
              <input value={draft.phoneLabel} disabled={!canEdit} onChange={(e) => setField('phoneLabel', e.target.value)} />
            </Field>
            <Field id="help-whatsapp" label="WhatsApp number" hint="Digits the app opens in WhatsApp. Leave blank for now.">
              <input value={draft.whatsapp} disabled={!canEdit} onChange={(e) => setField('whatsapp', e.target.value)} />
            </Field>
            <Field id="help-email" label="Email">
              <input value={draft.email} disabled={!canEdit} onChange={(e) => setField('email', e.target.value)} />
            </Field>
            <Field id="help-hours" label="Working hours" hint="For example, 24×7 or 9am to 6pm.">
              <input value={draft.hours} disabled={!canEdit} onChange={(e) => setField('hours', e.target.value)} />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Questions"
          actions={
            canEdit ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus size={16} />}
                onClick={() => setDraft((current) => ({ ...current, faqs: [...current.faqs, { key: draftKey(), question: '', answer: '' }] }))}
              >
                Add question
              </Button>
            ) : null
          }
        >
          {draft.faqs.length === 0 ? (
            <EmptyState
              icon={<LifeBuoy size={22} />}
              title="No questions yet"
              description="Add a question when the answer is ready. The app shows them in this order."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {draft.faqs.map((faq, index) => (
                <div key={faq.key} style={styles.faq}>
                  <Field id={`help-q-${faq.key}`} label={`Question ${index + 1}`}>
                    <input value={faq.question} disabled={!canEdit} onChange={(e) => setFaq(faq.key, 'question', e.target.value)} />
                  </Field>
                  <Field id={`help-a-${faq.key}`} label="Answer">
                    <textarea rows={3} value={faq.answer} disabled={!canEdit} onChange={(e) => setFaq(faq.key, 'answer', e.target.value)} />
                  </Field>
                  {canEdit ? (
                    <div style={styles.faqActions}>
                      <Button variant="ghost" size="sm" icon={<ArrowUp size={15} />} disabled={index === 0} onClick={() => moveFaq(index, -1)}>
                        Up
                      </Button>
                      <Button variant="ghost" size="sm" icon={<ArrowDown size={15} />} disabled={index === draft.faqs.length - 1} onClick={() => moveFaq(index, 1)}>
                        Down
                      </Button>
                      <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => void removeFaq(faq)}>
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Panel>

        {formError ? <FormError>{formError}</FormError> : null}
      </LoadState>
      {dialog}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' },
  faq: { border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  faqActions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
};
