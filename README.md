# 🟡 Pac-Man Clone (HTML5 + JavaScript)

A classic arcade-style Pac-Man game built using JavaScript and the HTML5 Canvas API. Navigate the maze, collect pellets, avoid ghosts, and beat your high score!

## 🎮 Gameplay Features

- Grid-based maze with walls, pellets, and power-ups
- Player-controlled Pac-Man with smooth directional movement
- AI-driven ghosts with simple pathfinding
- Power pellets that let you eat ghosts temporarily
- Score tracking and lives system
- Customizable map layout and characters

## 🚀 Demo

> _[Link to live demo (if hosted)]_  
> Coming soon...

## 🛠️ Technologies Used

- **JavaScript (ES6+)**
- **HTML5 Canvas API**
- No external libraries or frameworks — pure vanilla JS!

## 📁 Project Structure

```
root/
├── index.html # Entry point
├── favicon.ico # App icon
├── .gitignore
├── .vscode/ # VSCode config
├── assets/ # (Optional) Images, sounds, etc.
├── src/
├── components/
│ ├── boundary.js # Maze walls and boundaries
│ ├── ghost.js # Ghost AI and rendering
│ ├── hero.js # Shared base class for Pac-Man & ghosts
│ ├── pacman.js # Pac-Man behavior and animation
│ ├── pellet.js # Regular and power pellet logic
│ ├── tile.js # Tile types (walls, pellets, etc.)
│ └── tilemap.js # Maze generation from layout
├── collisions.js # Collision detection logic
├── constants.js # Game constants (tile size, colors, speed)
├── Loader.js # Asset preloader (images, sounds)
├── main.js # Main game loop and orchestration
└── mazeLayout.json # 2D array layout for maze grid
```

## 🎮 Controls

- **Arrow keys / WASD** – Move Pac-Man
- **R** – Restart game (if implemented)
- **P** – Pause/resume (optional)

## 📸 Screenshots

> _(Add screenshots or a GIF of gameplay here)_

## 🎨 Design

- Canvas API: All drawing and animation done with canvas.getContext('2d')
- Scalable tile-based system: Driven by mazeLayout.json and tilemap.js
- Custom ghost and player rendering using modular components

## 🧠 AI Overview (Ghosts)

Each ghost has a different behavior:
- **Chase Mode:** Follows the player
- **Scatter Mode:** Retreats to corners
- **Frightened Mode:** Moves randomly when vulnerable

You can extend each ghost's AI individually in the `ghost.js` file.

---

## 📦 Installation

No build tools or frameworks required — it's 100% browser-based.

1. Clone the repository:

```bash
   git clone https://github.com/g-t-georgiev/pacman.git
   cd pacman
```

2. Open index.html in your browser. 
3. No server required – runs fully in the browser!

---

## 🔮 Future Enhancements (WIP)

- Level progression with multiple levels and increasing difficulty
- High score leaderboard (local or online)
- Mobile touch controls
- Sound effects and music
- Custom map editor
- Touch controls for mobile
- Leaderboard using local storage or backend

## 🧑‍💻 Contributing

Pull requests and suggestions are welcome! Please fork the repo and submit a PR or open an issue to discuss changes.

## 📄 License

MIT License

---

Built with ❤️ using JavaScript + Canvas.