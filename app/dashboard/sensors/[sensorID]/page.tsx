export default function SensorPage({
  params,
}: {
  params: { sensorID: string };
}) {
  console.log(params.sensorID);
  return (
    <div>
      <h1>Sensor Page</h1>
    </div>
  );
}
