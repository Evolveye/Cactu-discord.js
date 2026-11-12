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
  | `help.optionalParam`
  | `help.nothing`
  | `help.restParam`
  | `help.commands`
  | `help.scopes`
  | `label.providedValue`
  | `label.parameter`
  | `label.optional`
  | `label.rest`
  | `label.mask`
  | `label.yes`
  | `label.no`
  | `system.loadSuccess`

export type TranslationObject = Partial<Record<TranslationKeys, string>>
