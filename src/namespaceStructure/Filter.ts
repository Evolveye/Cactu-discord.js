export type FilterTester = RegExp | ((message:string) => boolean)
export type FilterEvaluator<T = unknown> = (text:string, context:T) => void | Promise<void>
export default class Filter<T = unknown> {
  #tester: FilterTester
  #fn: FilterEvaluator<T>

  constructor( tester:FilterTester, fn:FilterEvaluator<T> ) {
    this.#tester = tester
    this.#fn = fn
  }

  test( message:string ) {
    const tester = this.#tester
    const testPassed = typeof tester === `function`
      ? tester( message )
      : tester.test( message )

    return testPassed
  }

  async apply( text:string, ctx:T ) {
    return this.#fn( text, ctx )
  }
}