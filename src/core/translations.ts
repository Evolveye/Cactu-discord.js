export type TranslationKeys =
  | `err.noPath`
  | `err.noPerms`
  | `err.noParam`
  | `err.badParam`
  | `err.tooManyParams`
  | `err.invalidCommand`
  | `err.error`
  | `err.noAttachment`
  | `help.title`
  | `help.showDescription`
  | `help.requiredParam`
  | `help.optionalParam`
  | `help.nothing`
  | `help.restParam`
  | `help.commands`
  | `help.scopes`
  | `help.params`
  | `label.providedValue`
  | `label.parameter`
  | `label.required`
  | `label.optional`
  | `label.default`
  | `label.rest`
  | `label.mask`
  | `label.yes`
  | `label.no`
  | `system.loadSuccess`

export type TranslationObject = Partial<Record<TranslationKeys, string>>
