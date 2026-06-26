function validateViewData(params: {
  type: string;
  version: number;
  data: unknown;
}) {
  const migrationResult = migrate(type, version, data);
  const validationResult = validate(type, data);
  return validationResult;
}

function saveBlock(params: { id?: string; type: string; data: unknown }) {
  const validationResult = validate(type, data);
  const currentVersion = getCurrentVersion(type);
  const result = db.block.save({
    type,
    version: currentVersion,
    data,
  });
  return result;
}

function renderView<K extends string>(params: {
  type: K;
  data: (typeof registry)[K];
}) {
  let Component = null;

  // get component

  return <Component {...data} />;
}

function renderEditor<K extends string>(params: {
  id?: string;
  type: K;
  fields: object;
}) {
  let Component = null;

  // get component

  return <Component {...data} />;
}

function getFormData(params: { type: string; data: object }) {
  return registry[type].transforms.toForm(data);
}
