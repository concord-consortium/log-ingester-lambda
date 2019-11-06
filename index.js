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
  let client = null;

  try {
    const connectionString = process.env.RDS_DATABASE_URL;
    if (!connectionString) {
      throw new Error("Missing RDS_DATABASE_URL environment variable");
    }

    client = new Client({connectionString, statement_timeout: 1000*10});
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

    console.log(`Insertion results: ${JSON.stringify(output)}`);

    return {
      statusCode: 200,
      body: JSON.stringify(output),
    }
  }
  catch (err) {
    console.error(`Error: ${err.toString()}`);
    return {
      statusCode: 400, // can't be 500 as that is not part of the CloudWatch Errors metric for Lambda functions
      body: JSON.stringify({error: err.toString()})
    }
  }
  finally {
    if (client) {
      client.end();
    }
  }
};
