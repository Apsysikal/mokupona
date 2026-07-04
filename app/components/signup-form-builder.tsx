import {
  getInputProps,
  getSelectProps,
  useFormMetadata,
  type FieldMetadata,
} from "@conform-to/react";

import { CheckboxField, ErrorList, Field, SelectField } from "./forms";
import { Button } from "./ui/button";

import {
  NON_LIST_FIELD_TYPES,
  type NonListFieldType,
} from "~/features/forms/fields/non-list";
import {
  slugifyFieldKey,
  type BuilderItemRow,
  type BuilderItemRowInput,
  type BuilderRowInput,
} from "~/features/signup-form/builder";
import {
  FIXED_IDENTITY_FIELDS,
  MAX_FRIENDS_COUNT,
} from "~/features/signup-form/schema";

// The admin "Signup form" section (design §10): a field array of descriptor
// rows. The friends list and the name/email/phone identity fields are pinned
// — rendered without type/key/remove controls — everything else is free.

// derived from the profile so the pin set can't drift from what the server
// actually requires
const PINNED_IDENTITY_KEYS = new Set<string>(
  FIXED_IDENTITY_FIELDS.map((field) => field.name),
);

const TYPE_LABELS: Record<NonListFieldType, string> = {
  text: "Text",
  textarea: "Text area",
  email: "Email",
  phone: "Phone",
  checkbox: "Checkbox",
};

const TYPE_OPTIONS = NON_LIST_FIELD_TYPES.map((type) => ({
  label: TYPE_LABELS[type],
  value: type,
}));

const NEW_ROW: BuilderItemRow = {
  type: "text",
  name: "",
  label: "",
  required: false,
};

type RowMetadata = FieldMetadata<BuilderRowInput>;
type ItemRowMetadata = FieldMetadata<BuilderItemRowInput>;
// EditableRowView renders the keys the two row shapes share
type EditableRowMetadata = RowMetadata | ItemRowMetadata;

export function SignupFormBuilder({
  field,
}: {
  field: FieldMetadata<BuilderRowInput[]>;
}) {
  const form = useFormMetadata();
  const rows = field.getFieldList();

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border p-4">
      <legend className="px-1 text-lg font-medium">Signup form</legend>

      <ErrorList id={field.errorId} errors={field.errors} />

      <ul className="flex flex-col gap-4">
        {rows.map((row, index) => (
          <BuilderRowView
            key={row.key}
            row={row as RowMetadata}
            listName={field.name}
            index={index}
            count={rows.length}
          />
        ))}
      </ul>

      <Button
        variant="outline"
        {...form.insert.getButtonProps({
          name: field.name,
          defaultValue: NEW_ROW,
        })}
      >
        Add field
      </Button>
    </fieldset>
  );
}

function BuilderRowView({
  row,
  listName,
  index,
  count,
}: {
  row: RowMetadata;
  listName: string;
  index: number;
  count: number;
}) {
  const rowFields = row.getFieldset();
  const type = String(rowFields.type.value ?? "");
  // pinned-ness is decided by the row's INITIAL key: a custom row whose key
  // is edited to "email" must not morph into an unremovable pinned row
  const initialKey = String(rowFields.name.initialValue ?? "");

  if (type === "list") {
    return (
      <li className="flex flex-col gap-4 rounded-md border p-3">
        <RowHeader
          title="Friends (pinned)"
          listName={listName}
          index={index}
          count={count}
        />
        <ErrorList id={row.errorId} errors={row.errors} />
        <FriendsRowView row={row} />
      </li>
    );
  }

  const isPinnedIdentity = PINNED_IDENTITY_KEYS.has(initialKey);

  return (
    <li className="flex flex-col gap-4 rounded-md border p-3">
      <RowHeader
        title={isPinnedIdentity ? `${initialKey} (pinned)` : "Field"}
        listName={listName}
        index={index}
        count={count}
        removable={!isPinnedIdentity}
      />
      <ErrorList id={row.errorId} errors={row.errors} />
      {isPinnedIdentity ? (
        <PinnedIdentityRowView row={row} />
      ) : (
        <EditableRowView row={row} />
      )}
    </li>
  );
}

// Reorder is free for every row; removal only for custom fields.
function RowHeader({
  title,
  listName,
  index,
  count,
  removable = false,
}: {
  title: string;
  listName: string;
  index: number;
  count: number;
  removable?: boolean;
}) {
  const form = useFormMetadata();

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium capitalize">{title}</span>
      <span className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={index === 0}
          {...form.reorder.getButtonProps({
            name: listName,
            from: index,
            to: Math.max(0, index - 1),
          })}
        >
          Up
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={index === count - 1}
          {...form.reorder.getButtonProps({
            name: listName,
            from: index,
            to: Math.min(count - 1, index + 1),
          })}
        >
          Down
        </Button>
        {removable ? (
          <Button
            variant="destructive"
            size="sm"
            {...form.remove.getButtonProps({ name: listName, index })}
          >
            Remove
          </Button>
        ) : null}
      </span>
    </div>
  );
}

// Identity fields: label is editable, everything else is fixed and submitted
// via hidden inputs (disabled inputs would not submit).
function PinnedIdentityRowView({ row }: { row: RowMetadata }) {
  const rowFields = row.getFieldset();

  return (
    <div className="flex flex-col gap-3">
      {/* pinned values ride along as hidden inputs (disabled inputs would
          not submit); the server re-validates the profile regardless */}
      <input {...getInputProps(rowFields.type, { type: "hidden" })} />
      <input {...getInputProps(rowFields.name, { type: "hidden" })} />
      <input type="hidden" name={rowFields.required.name} value="on" />

      <Field
        labelProps={{ children: "Label" }}
        inputProps={{ ...getInputProps(rowFields.label, { type: "text" }) }}
        errors={rowFields.label.errors}
      />
      <p className="text-muted-foreground text-xs">Always required.</p>
    </div>
  );
}

function EditableRowView({ row }: { row: EditableRowMetadata }) {
  const form = useFormMetadata();
  const rowFields = row.getFieldset();
  const labelInputProps = getInputProps(rowFields.label, { type: "text" });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SelectField
          className="grow"
          labelProps={{ children: "Type" }}
          selectProps={{
            ...getSelectProps(rowFields.type),
            options: TYPE_OPTIONS,
          }}
          errors={rowFields.type.errors}
        />
        <Field
          className="grow"
          labelProps={{ children: "Label" }}
          inputProps={{
            ...labelInputProps,
            onBlur: (event) => {
              // new fields derive their machine key from the label
              if (!rowFields.name.value) {
                form.update({
                  name: rowFields.name.name,
                  value: slugifyFieldKey(event.currentTarget.value),
                });
              }
            },
          }}
          errors={rowFields.label.errors}
        />
        <Field
          className="grow"
          labelProps={{ children: "Field key" }}
          inputProps={{ ...getInputProps(rowFields.name, { type: "text" }) }}
          errors={rowFields.name.errors}
        />
      </div>
      <CheckboxField
        labelProps={{ children: "Required" }}
        buttonProps={{
          ...getInputProps(rowFields.required, { type: "checkbox" }),
        }}
        errors={rowFields.required.errors}
      />
    </div>
  );
}

// The friends list is pinned: it cannot be removed or renamed, and lists are
// not addable — its item fields and maxCount are the only structural knobs.
function FriendsRowView({ row }: { row: RowMetadata }) {
  const form = useFormMetadata();
  const rowFields = row.getFieldset();
  const itemFields = rowFields.itemFields.getFieldList();

  return (
    <div className="flex flex-col gap-4">
      <input {...getInputProps(rowFields.type, { type: "hidden" })} />
      <input {...getInputProps(rowFields.name, { type: "hidden" })} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Field
          className="grow"
          labelProps={{ children: "Label" }}
          inputProps={{ ...getInputProps(rowFields.label, { type: "text" }) }}
          errors={rowFields.label.errors}
        />
        <Field
          className="grow"
          labelProps={{
            children: `Maximum friends per signup (0–${MAX_FRIENDS_COUNT}, 0 disables friends)`,
          }}
          inputProps={{
            ...getInputProps(rowFields.maxCount, { type: "number" }),
            min: 0,
            max: MAX_FRIENDS_COUNT,
          }}
          errors={rowFields.maxCount.errors}
        />
      </div>

      <div className="flex flex-col gap-3 border-l pl-4">
        <span className="text-sm font-medium">Questions per friend</span>
        <ErrorList
          id={rowFields.itemFields.errorId}
          errors={rowFields.itemFields.errors}
        />
        <ul className="flex flex-col gap-4">
          {itemFields.map((itemRow, index) => (
            <li key={itemRow.key} className="flex flex-col gap-3">
              <RowHeader
                title="Friend field"
                listName={rowFields.itemFields.name}
                index={index}
                count={itemFields.length}
                removable
              />
              <ErrorList id={itemRow.errorId} errors={itemRow.errors} />
              <EditableRowView row={itemRow as ItemRowMetadata} />
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          {...form.insert.getButtonProps({
            name: rowFields.itemFields.name,
            defaultValue: NEW_ROW,
          })}
        >
          Add friend field
        </Button>
      </div>
    </div>
  );
}
