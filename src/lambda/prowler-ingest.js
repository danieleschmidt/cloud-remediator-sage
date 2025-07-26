// Placeholder for Prowler ingestion Lambda
exports.handler = async (_event) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Prowler ingest - placeholder' })
  };
};