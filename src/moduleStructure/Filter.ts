export type FilterTest = RegExp | (() => boolean)
export type FilterEvaluator = () => void
export default class Filter {
  #test: FilterTest
  #fn: FilterEvaluator

  constructor( test:FilterTest, fn:FilterEvaluator ) {
    this.#test = test
    this.#fn = fn
  }
}
