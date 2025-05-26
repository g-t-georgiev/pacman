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
/pacman-game/
├── index.html # Main HTML file
├── style.css # Optional styles (HUD, UI)
├── game.js # Game loop and state manager
├── player.js # Player (Pac-Man) logic
├── ghost.js # Ghost logic and AI
├── map.js # Maze/grid rendering
├── utils.js # Helper functions
└── assets/ # Images, sounds (if any)
```

## 🎮 Controls

- **Arrow keys / WASD** – Move Pac-Man
- **R** – Restart game (if implemented)
- **P** – Pause/resume (optional)

## 📸 Screenshots

> _(Add screenshots or a GIF of gameplay here)_

## 🧠 AI Overview (Ghosts)

Each ghost has a different behavior:
- **Chase Mode:** Follows the player
- **Scatter Mode:** Retreats to corners
- **Frightened Mode:** Moves randomly when vulnerable

You can extend each ghost's AI individually in the `ghost.js` file.

---

## 📦 Installation

1. Clone the repository:

```bash
   git clone https://github.com/your-username/pacman-clone.git
   cd pacman-clone
```

2. Open index.html in your browser. 
3. No server required – runs fully in the browser!

---

## 🔮 Future Features (WIP)

- Level progression
- High score leaderboard (local or online)
- Mobile touch controls
- Sound effects and music
- Custom map editor

## 🧑‍💻 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you’d like to change or improve.

## 📄 License

MIT

---

Built with ❤️ using JavaScript + Canvas.