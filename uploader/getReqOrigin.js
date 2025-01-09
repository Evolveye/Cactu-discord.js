/** * @param {http.IncomingMessage} req */
export default function getReqOrigin( req ) {
  return req.headers.host?.includes( `localhost` )
    ? `http://localhost:3000`
    : req.headers.referer?.match( /(?<origin>https?:\/\/(?<host>localhost|\d+\.\d+\.\d+\.\d+)(?::(?<port>\d+))?)/ )?.groups.origin ?? `*`
}
