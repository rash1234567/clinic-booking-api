import { useState } from "react";
import { resetSlots } from "../services/api";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

type AdminSlot = {
  id: string;
  provider: string;
  start: string;
  end: string;
};

type SlotDraft = {
  provider: string;
  start: string;
  end: string;
};

type AdminSlotManagerProps = {
  onSaved: () => Promise<void>;
};

const emptyDraft: SlotDraft = {
  provider: "",
  start: "",
  end: "",
};

function getLocalDateTime(date = new Date()): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);

  return localDate.toISOString().slice(0, 16);
}

function toLocalDateTime(date: Date | null): string {
  if (!date) return "";

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function AdminSlotForm({
  draft,
  editing,
  error,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: SlotDraft;
  editing: boolean;
  error: string;
  onChange: (field: keyof SlotDraft, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  const startDate = draft.start ? new Date(draft.start) : null;
  const endDate = draft.end ? new Date(draft.end) : null;

  return (
    <form className="admin-slot-form" onSubmit={onSubmit}>
      <h3>{editing ? "Edit appointment slot" : "Add appointment slot"}</h3>

      <label htmlFor="admin-provider">Provider name</label>
      <input
        id="admin-provider"
        type="text"
        placeholder="e.g. Dr Ade"
        value={draft.provider}
        onChange={(event) => onChange("provider", event.target.value)}
        required
      />

      <label>Appointment start</label>
      <DatePicker
        selected={startDate}
        onChange={(date: Date | null) =>
          onChange("start", toLocalDateTime(date))
        }
        showTimeSelect
        timeIntervals={15}
        dateFormat="MMMM d, yyyy h:mm aa"
        minDate={new Date()}
        minTime={
          startDate && startDate.toDateString() === new Date().toDateString()
            ? new Date()
            : new Date(new Date().setHours(0, 0, 0, 0))
        }
        maxTime={new Date(new Date().setHours(23, 45, 0, 0))}
        placeholderText="Choose appointment start"
        className="admin-date-picker"
        wrapperClassName="admin-date-picker-wrapper"
        required
      />

      <label>Appointment end</label>
      <DatePicker
        selected={endDate}
        onChange={(date: Date | null) => onChange("end", toLocalDateTime(date))}
        showTimeSelect
        timeIntervals={15}
        dateFormat="MMMM d, yyyy h:mm aa"
        minDate={startDate || new Date()}
        minTime={
          startDate &&
          endDate &&
          startDate.toDateString() === endDate.toDateString()
            ? startDate
            : new Date(new Date().setHours(0, 0, 0, 0))
        }
        maxTime={new Date(new Date().setHours(23, 45, 0, 0))}
        placeholderText="Choose appointment end"
        className="admin-date-picker"
        wrapperClassName="admin-date-picker-wrapper"
        required
      />

      {error && <p className="error-message">{error}</p>}

      <div className="admin-form-actions">
        <button type="submit" className="primary-button">
          {editing ? "Update slot" : "Add slot"}
        </button>

        {editing && (
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel edit
          </button>
        )}
      </div>
    </form>
  );
}

function AdminSlotCard({
  slot,
  index,
  onEdit,
  onDelete,
}: {
  slot: AdminSlot;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="admin-slot-card">
      <div className="admin-slot-details">
        <span className="admin-slot-number">Slot {index + 1}</span>

        <h3>{slot.provider}</h3>

        <p>
          <strong>Start:</strong> {new Date(slot.start).toLocaleString()}
        </p>

        <p>
          <strong>End:</strong> {new Date(slot.end).toLocaleString()}
        </p>
      </div>

      <div className="admin-card-actions">
        <button type="button" className="secondary-button" onClick={onEdit}>
          Edit
        </button>

        <button type="button" className="cancel-button" onClick={onDelete}>
          Delete
        </button>
      </div>
    </article>
  );
}

export default function AdminSlotManager({ onSaved }: AdminSlotManagerProps) {
  const [slots, setSlots] = useState<AdminSlot[]>([]);
  const [draft, setDraft] = useState<SlotDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function updateDraft(field: keyof SlotDraft, value: string) {
    setDraft((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFormError("");
    setSaveMessage("");
  }

  function handleAddOrUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const provider = draft.provider.trim();
    const start = new Date(draft.start).getTime();
    const end = new Date(draft.end).getTime();

    if (!provider || !draft.start || !draft.end) {
      setFormError("Please complete all fields.");
      return;
    }

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setFormError("Please enter valid appointment dates.");
      return;
    }

    if (start <= Date.now()) {
      setFormError("The appointment start time must be in the future.");
      return;
    }

    if (end <= start) {
      setFormError("The end time must be after the start time.");
      return;
    }

    if (editingId) {
      setSlots((previous) =>
        previous.map((slot) =>
          slot.id === editingId
            ? { ...slot, provider, start: draft.start, end: draft.end }
            : slot
        )
      );

      setEditingId(null);
      setSaveMessage("Appointment slot updated.");
    } else {
      setSlots((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          provider,
          start: draft.start,
          end: draft.end,
        },
      ]);

      setSaveMessage("Appointment slot added.");
    }

    setDraft(emptyDraft);
    setFormError("");
  }

  function handleEdit(slot: AdminSlot) {
    setDraft({
      provider: slot.provider,
      start: slot.start,
      end: slot.end,
    });

    setEditingId(slot.id);
    setFormError("");
    setSaveMessage("");
  }

  function handleDelete(id: string) {
    setSlots((previous) => previous.filter((slot) => slot.id !== id));

    if (editingId === id) {
      setEditingId(null);
      setDraft(emptyDraft);
    }

    setSaveMessage("Appointment slot removed.");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft);
    setFormError("");
  }

  async function handleSaveSchedule() {
    if (slots.length === 0) {
      setSaveMessage("Add at least one appointment slot.");
      return;
    }

    const hasInvalidSlot = slots.some((slot) => {
      const start = new Date(slot.start).getTime();
      const end = new Date(slot.end).getTime();

      return (
        !slot.provider.trim() ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start <= Date.now() ||
        end <= start
      );
    });

    if (hasInvalidSlot) {
      setSaveMessage(
        "One or more slots are invalid or have a start time in the past. Please edit them."
      );
      return;
    }

    try {
      setSaving(true);
      setSaveMessage("");

      await resetSlots(
        slots.map((slot) => ({
          id: slot.id,
          provider: slot.provider,
          start: new Date(slot.start).toISOString(),
          end: new Date(slot.end).toISOString(),
        }))
      );

      setSlots([]);
      setDraft(emptyDraft);
      setEditingId(null);
      setFormError("");

      setSaveMessage("Appointment schedule saved successfully.");

      await onSaved();
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? error.message
          : "Unable to save appointment schedule."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-section">
      <div className="admin-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h2>Manage appointment slots</h2>
          <p className="form-description">
            Add and manage appointment times for your healthcare providers.
          </p>
        </div>
      </div>

      <AdminSlotForm
        draft={draft}
        editing={editingId !== null}
        error={formError}
        onChange={updateDraft}
        onSubmit={handleAddOrUpdate}
        onCancel={handleCancelEdit}
      />

      <div className="admin-slots-list">
        <div className="admin-slots-heading">
          <h3>Appointment slots</h3>
          <span>{slots.length} added</span>
        </div>

        {slots.length === 0 ? (
          <p className="message">
            No slots added yet. Complete the form above to add your first slot.
          </p>
        ) : (
          <div className="admin-slots-grid">
            {slots.map((slot, index) => (
              <AdminSlotCard
                key={slot.id}
                slot={slot}
                index={index}
                onEdit={() => handleEdit(slot)}
                onDelete={() => handleDelete(slot.id)}
              />
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="primary-button save-schedule-button"
        onClick={handleSaveSchedule}
        disabled={saving || slots.length === 0 || editingId !== null}
      >
        {saving ? "Saving..." : "Save appointment schedule"}
      </button>

      {saveMessage && <p className="message">{saveMessage}</p>}

      <p className="admin-warning">
        Saving replaces all existing slots and deletes existing bookings.
      </p>
    </section>
  );
}
