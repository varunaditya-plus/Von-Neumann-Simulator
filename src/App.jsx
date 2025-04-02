import { VonNeumannSimulation } from "./components/von-neumann-simulation";
import Watermark from "./components/watermark"

function App() {
  return (
    <main className="max-w-5xl mx-auto p-4 min-h-screen w-screen">
      <Watermark />
      <VonNeumannSimulation />
    </main>
  )
}

export default App
