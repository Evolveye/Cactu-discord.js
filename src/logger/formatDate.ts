type DateParts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
  milis: string
}

export type DateString = `${number}-${number}-${number}T${number}:${number}:${number}`

export default function formatDate( date:Date | DateString | number = new Date(), format = `YYYY.MM.DD hh:mm` ) {
  const dateParts = getDateparts( date )

  return `${format}`
    .replace( /YYYY/, dateParts.year as string )
    .replace( /YY/, dateParts.year.slice( -2 ) )
    .replace( /MM/, dateParts.month )
    .replace( /DD/, dateParts.day as string )
    .replace( /hh/, dateParts.hour as string )
    .replace( /mm/, dateParts.minute as string )
    .replace( /ss/, dateParts.second as string )
    .replace( /ms/, dateParts.milis.toString().slice( -4 ) )
}

export function getDateparts( date:Date | DateString | number = new Date() ): DateParts {
  const time = typeof date === `number` ? date : new Date( date ).getTime()
  const options:Intl.DateTimeFormatOptions = {
    year: `numeric`,
    month: `2-digit`,
    day: `2-digit`,
    hour: `2-digit`,
    minute: `2-digit`,
    second: `2-digit`,
  }

  const parts = new Intl.DateTimeFormat( `pl`, options ).formatToParts( time )
  const partsDescribedInOptions = parts.filter( ({ type }) => type in options )
  const processedParts = Object.fromEntries( partsDescribedInOptions.map( ({ type, value }) => [ type, value ] ) )

  return { ...processedParts, milis:time.toString().slice( -4 ) } as DateParts
}

export function isValidDatePattern( pattern:string ) {
  return !isNaN( Date.parse( pattern ) )
}
