const { Client } = require('pg')
const hstore = require('pg-hstore')();

const canonicalize = (rawData, timestamp) => {
  const data = {};
  ['session', 'username', 'application', 'activity', 'event', 'event_value', 'run_remote_endpoint'].forEach((col) => {
    data[col] = rawData.hasOwnProperty(col) ? String(rawData[col]) : null;
  })
  data.time = timestamp;
  data.parameters = hstore.stringify(rawData.parameters || {});
  var extras = {};
  Object.keys(rawData).forEach((key) => {
    if (!data.hasOwnProperty(key)) {
      extras[key] = rawData[key]
    }
  });
  data.extras = hstore.stringify(extras);
  return data;
};

exports.handler = async (event) => {
  try {
    const connectionString = process.env.RDS_DATABASE_URL;
    if (!connectionString) {
      throw new Error("Missing RDS_DATABASE_URL environment variable");
    }

    const client = new Client({connectionString});
    await client.connect();

    console.log(`Event Received: ${JSON.stringify(event)}`);
    const results = event.Records.map(async (record) => {
      // Kinesis data is base64 encoded so decode here
      const payload = new Buffer.from(record.kinesis.data, 'base64').toString();
      console.log(`Got payload: ${JSON.stringify(payload)}`);

      // payload looks like <mstimestamp>;<json> where <timestamp> is added by the API gateway transform
      const payloadParts = payload.split(';')
      let rawTimestamp = parseInt(payloadParts.shift(), 10);
      if (isNaN(rawTimestamp)) {
        rawTimestamp = Date.now();
      }
      const timestamp = Math.round(rawTimestamp / 1000);
      const entry = canonicalize(JSON.parse(payloadParts.join(';')), timestamp)
      const {session, username, application, activity, event, time, parameters, extras, event_value, run_remote_endpoint} = entry;
      console.log(`Inserting entry: ${JSON.stringify(entry)}`);
      const result = await client.query(`
        INSERT INTO logs
          (session, username, application, activity, event, time, parameters, extras, event_value, run_remote_endpoint)
        VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7, $8, $9, $10) RETURNING id`,
          [session, username, application, activity, event, time, parameters, extras, event_value, run_remote_endpoint]
      );
      return {id: result.rows[0].id, entry};
    });

    const output = await Promise.all(results);

    return {
      statusCode: 200,
      body: JSON.stringify(output),
    }
  }
  catch (err) {
    return {
      statusCode: 400, // can't be 500 as that is not part of the CloudWatch Errors metric for Lambda functions
      body: JSON.stringify({error: err.toString()})
    }
  }
};

// TEST DATA
// const foo = {"session": "test: session", "username": "test: username", "application": "test: application", "activity": "test: activity", "event": "test: event", "parameters": {"p1": "test p1", "p2": "test p2"}, "event_value": "test: event_value", "run_remote_endpoint": "test: run_remote_endpoint", "foo": "bar", "baz": "bam"}
// 1549454904899;{"session": "test: session", "username": "test: username", "application": "test: application", "activity": "test: activity", "event": "test: event", "parameters": {"p1": "test p1", "p2": "test p2"}, "event_value": "test: event_value", "run_remote_endpoint": "test: run_remote_endpoint", "foo": "bar", "baz": "bam"}

// TEST (will run but then not exit because node sees it is a module)
// const event = {Records: [{kinesis: {data: "MTU0OTQ1NDkwNDg5OTt7InNlc3Npb24iOiAidGVzdDogc2Vzc2lvbiIsICJ1c2VybmFtZSI6ICJ0ZXN0OiB1c2VybmFtZSIsICJhcHBsaWNhdGlvbiI6ICJ0ZXN0OiBhcHBsaWNhdGlvbiIsICJhY3Rpdml0eSI6ICJ0ZXN0OiBhY3Rpdml0eSIsICJldmVudCI6ICJ0ZXN0OiBldmVudCIsICJwYXJhbWV0ZXJzIjogeyJwMSI6ICJ0ZXN0IHAxIiwgInAyIjogInRlc3QgcDIifSwgImV2ZW50X3ZhbHVlIjogInRlc3Q6IGV2ZW50X3ZhbHVlIiwgInJ1bl9yZW1vdGVfZW5kcG9pbnQiOiAidGVzdDogcnVuX3JlbW90ZV9lbmRwb2ludCIsICJmb28iOiAiYmFyIiwgImJheiI6ICJiYW0ifQ=="}}]}
// const event = {
//   "Records": [
//       {
//           "kinesis": {
//               "kinesisSchemaVersion": "1.0",
//               "partitionKey": "todo",
//               "sequenceNumber": "49592726167714857316135803118515680514645498297090834434",
//               "data": "O3sic2Vzc2lvbiI6InRlc3QiLCJ1c2VybmFtZSI6ImRtYXJ0aW4ifQ==",
//               "approximateArrivalTimestamp": 1549473921.272
//           },
//           "eventSource": "aws:kinesis",
//           "eventVersion": "1.0",
//           "eventID": "shardId-000000000000:49592726167714857316135803118515680514645498297090834434",
//           "eventName": "aws:kinesis:record",
//           "invokeIdentityArn": "arn:aws:iam::612297603577:role/log-ingester-staging-kinesis-lambda",
//           "awsRegion": "us-east-1",
//           "eventSourceARN": "arn:aws:kinesis:us-east-1:612297603577:stream/log-ingester-staging-api-gateway-stream"
//       }
//   ]
// };
// exports.handler(event).then(console.log).catch(console.error)
