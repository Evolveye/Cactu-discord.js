/** @template TVariables */
export class Filter {
  /** @typedef {($:TVariables) => (string | null)} FilterExecutor */
  /** @type {RegExp} */
  #regExp = null

  /** @type {FilterExecutor} */
  #executor = null


  /**
   * @param {RegExp} regExp
   * @param {FilterExecutor} executor
   */
  constructor( regExp, executor ) {
    this.#regExp = regExp
    this.#executor = executor
  }


  /** @param {string} string */
  match( string ) {
    const match = string.match( this.#regExp )

    if (match === null) return null

    return this.#regExp.global ? match : [ match[ 0 ] ]
  }


  /** @param {TVariables} variables */
  execute( variables ) {
    return this.#executor( variables )
  }


  static State = {
    STOP_FILTERING: `Stop filtering`,
    NOT_MATCHED: `Not matched`,
  }

}

export default class FiltersProcessor {
  /** @type {Filter<object>[][]} */
  #filters = []


  setFilters( filters ) {
    const normalizedFilters = []

    for (const filterOrBranch of filters) {
      /** @type {Filter[]} */
      const branch = filterOrBranch instanceof Filter ? [ filterOrBranch ] : filterOrBranch

      if (!Array.isArray( branch )) continue

      for (const probablyFilter of branch) if (!(probablyFilter instanceof Filter)) {
        branch.splice( branch.indexOf( probablyFilter ), 1 )
      }

      if (branch.length) normalizedFilters.push( branch )
    }

    this.#filters = normalizedFilters
  }


  /**
   * @param {string} string
   * @param {(matches:string[]) => object} getVariables
   */
  process( string, getVariables ) {
    let matched = false

    for (const branch of this.#filters) {
      for (const filter of branch) {
        const matches = filter.match( string )

        if (!matches) continue

        switch (filter.execute( getVariables( matches ) )) {
          case Filter.State.STOP_FILTERING: return
          case Filter.State.NOT_MATCHED: continue
        }

        matched = true

        break
      }
    }

    return matched
  }
}
