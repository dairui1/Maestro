import { Button } from '@heroui/react'

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Welcome to Maestro</h1>
        <p className="text-xl text-default-500">Built with React + Vite + HeroUI</p>
        <div className="flex gap-4 justify-center">
          <Button color="primary">Get Started</Button>
          <Button variant="bordered">Learn More</Button>
        </div>
      </div>
    </div>
  )
}

export default App