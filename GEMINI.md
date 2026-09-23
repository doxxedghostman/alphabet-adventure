# Project Overview
- **Type:** Cross-Platform Mobile / Web Game (Capacitor)
- **Primary Languages:** TypeScript / JavaScript
- **Tooling & Build:** Vite
- **Engine / Framework:** Canvas API / PixiJS (or your specific renderer)
- **Backend / Storage:** Supabase (Leaderboards, Auth, User State)

# Architecture & Game Loop
- Separate pure game logic (physics, scoring, collision) from DOM/Canvas rendering.
- Use a state machine for transitions (`Boot` -> `Menu` -> `Playing` -> `GameOver`).
- Ensure all movement and timer updates use delta-time for consistent performance across high and low refresh-rate screens.

# Performance & Capacitor Rules
- Do not instantiate objects inside `requestAnimationFrame` or the main update loop.
- Optimize touch/pointer events for low input latency on mobile webviews.
- Handle lifecycle events (pause game loops when the Capacitor app is backgrounded).

# Coding Constraints
- Keep modular classes/modules for game entities (`Player`, `Enemy`, `UIOverlay`).
- Maintain strict TypeScript types for game events, player stats, and state objects.