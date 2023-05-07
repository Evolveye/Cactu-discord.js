export type Tuple<T, L extends number, Arr extends unknown[] = []> =
  | Arr["length"] extends L
    ? Arr
    : Tuple<T, L, [...Arr, T]>;

type TupleCounter<Tuple extends readonly unknown[], ToFind extends unknown, CountArr extends unknown[] = []> =
  | Tuple extends readonly [infer First, ...infer Tail]
    ? First extends ToFind
      ? TupleCounter<Tail, ToFind, [...CountArr, unknown]>
      : TupleCounter<Tail, ToFind, CountArr>
    : Tuple extends []
      ? CountArr["length"]
      : never

type NegativeTupleCounter<Tuple extends readonly unknown[], ToFind extends unknown, CountArr extends unknown[] = []> =
  | Tuple extends readonly [infer First, ...infer Tail]
    ? First extends ToFind
      ? NegativeTupleCounter<Tail, ToFind, CountArr>
      : NegativeTupleCounter<Tail, ToFind, [...CountArr, unknown]>
    : Tuple extends []
      ? CountArr["length"]
      : never

export type TupleCount<Tuple extends readonly unknown[], ToFind extends unknown> = TupleCounter<Tuple, ToFind>
export type NegativeTupleCount<Tuple extends readonly unknown[], ToFind extends unknown> = NegativeTupleCounter<Tuple, ToFind>

// Primitive tests below


// type Opt = { opt: 1 }
// type Obli = { obli: 1 }
// type Full = { obli: 1; opt: 1 }
// type Obj = Obli & Partial<Opt>

// const objs = [
//   { obli:1, opt:1 },
//   { obli:1, opt:1 },
//   { obli:1 },
//   { obli:1, opt:1 },
//   { obli:1, opt:1 },
//   { obli:1 },
//   { obli:1, opt:1 },
//   { obli:1 },
// ] as const satisfies readonly Obj[]

// class Temp1<T extends readonly Obj[]> {
//   items: T

//   constructor( items:T ) {
//     this.items = items
//   }

//   getLength(): TupleCount<T, Opt> {
//     return this.items.length as TupleCount<T, Opt>
//   }
//   getNegLength(): NegativeTupleCount<T, Opt> {
//     return this.items.length as NegativeTupleCount<T, Opt>
//   }
//   run( ...items:Tuple<string, TupleCount<T, Opt>> ) {

//   }
//   negRun( ...items:Tuple<string, NegativeTupleCount<T, Opt>> ) {

//   }
// }

// let arr = []
// let temp = new Temp1( objs )

// temp.run()
// temp.negRun()
