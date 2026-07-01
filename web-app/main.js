/*jslint browser */
import R from "./ramda.js";
import Azul from "./Azul.js";

// Shorthand for getElementById – saves a lot of typing.
const el = (id) => document.getElementById(id);

// CSS class names for each colour value (1–5) and empty/marker.
const colour_class = ["empty", "blue", "yellow", "red", "black", "white"];
const colour_label = ["Empty", "Blue", "Yellow", "Red", "Black", "White"];
const marker_class = "marker";

// Penalty values shown under each floor slot.
const floor_penalty_labels = ["-1", "-1", "-2", "-2", "-2", "-3", "-3"];

let game_state = Azul.new_game();

// selection holds the pending draft choice once a source has been clicked.
// { source: "factory" | "centre", factory_index: number | null, colour: number }
let selection = null;

// -------------------------------------------------------------------------
// DOM helpers
// -------------------------------------------------------------------------

const make_tile = function (colour_value, extra_classes) {
    const div = document.createElement("div");
    div.className = "tile " + colour_class[colour_value] + (
        extra_classes
        ? " " + extra_classes
        : ""
    );
    div.setAttribute("aria-label", colour_label[colour_value] + " tile");
    return div;
};

const make_empty_slot = function (label) {
    const div = document.createElement("div");
    div.className = "tile empty";
    div.setAttribute("aria-label", label || "Empty slot");
    return div;
};

// -------------------------------------------------------------------------
// Rendering
// -------------------------------------------------------------------------

const render_factories = function () {
    const container = el("factories");
    container.innerHTML = "";
    game_state.factories.forEach(function (factory, factory_index) {
        const factory_div = document.createElement("div");
        factory_div.className = "factory";
        factory_div.setAttribute("aria-label", `Factory ${factory_index + 1}`);

        if (factory.length === 0) {
            factory_div.classList.add("empty_factory");
        }

        // Group tiles by colour so the player can click any tile of that colour.
        const colours_present = R.uniq(factory);
        colours_present.forEach(function (colour) {
            const count = factory.filter((t) => t === colour).length;
            R.range(0, count).forEach(function () {
                const tile = make_tile(colour);
                tile.tabIndex = 0;
                tile.setAttribute("role", "button");
                tile.setAttribute("aria-label", `Take ${colour_label[colour]} from factory ${factory_index + 1}`);

                const pick = function () {
                    if (Azul.is_ended(game_state)) {
                        return;
                    }
                    if (selection && selection.source === "factory" &&
                            selection.factory_index === factory_index &&
                            selection.colour === colour) {
                        selection = null;
                        render_all();
                        return;
                    }
                    selection = {
                        colour,
                        factory_index,
                        source: "factory"
                    };
                    render_all();
                };

                tile.onclick = pick;
                tile.onkeydown = function (event) {
                    if (event.key === "Enter" || event.key === " ") {
                        pick();
                    }
                };
                factory_div.append(tile);
            });
        });

        if (factory.length === 0) {
            const placeholder = make_empty_slot(`Factory ${factory_index + 1} is empty`);
            factory_div.append(placeholder);
        }

        // Highlight if this factory and colour are currently selected.
        if (selection && selection.source === "factory" &&
                selection.factory_index === factory_index) {
            factory_div.classList.add("selected_source");
        }

        container.append(factory_div);
    });
};

const render_centre = function () {
    const container = el("centre");
    container.innerHTML = "";

    if (game_state.centre.includes(-1)) {
        const marker = document.createElement("div");
        marker.className = "tile " + marker_class;
        marker.setAttribute("aria-label", "First-player marker");
        container.append(marker);
    }

    const real_tiles = game_state.centre.filter((t) => t > 0);
    const colours_in_centre = R.uniq(real_tiles);

    colours_in_centre.forEach(function (colour) {
        const count = real_tiles.filter((t) => t === colour).length;
        R.range(0, count).forEach(function () {
            const tile = make_tile(colour);
            tile.tabIndex = 0;
            tile.setAttribute("role", "button");
            tile.setAttribute("aria-label", `Take ${colour_label[colour]} from centre`);

            const pick = function () {
                if (Azul.is_ended(game_state)) {
                    return;
                }
                if (selection && selection.source === "centre" &&
                        selection.colour === colour) {
                    selection = null;
                    render_all();
                    return;
                }
                selection = {
                    colour,
                    factory_index: null,
                    source: "centre"
                };
                render_all();
            };

            tile.onclick = pick;
            tile.onkeydown = function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    pick();
                }
            };
            container.append(tile);
        });
    });

    if (real_tiles.length === 0 && !game_state.centre.includes(-1)) {
        const placeholder = make_empty_slot("Centre is empty");
        container.append(placeholder);
    }

    if (selection && selection.source === "centre") {
        el("centre_area").classList.add("selected_source");
    } else {
        el("centre_area").classList.remove("selected_source");
    }
};

const render_pattern_lines = function (player_index) {
    const container = el(`player${player_index}_pattern`);
    container.innerHTML = "";
    const player = game_state.players[player_index];
    const is_current = game_state.current_player === player_index && !Azul.is_ended(game_state);

    R.range(0, 5).forEach(function (row) {
        const line_div = document.createElement("div");
        line_div.className = "pattern_row";

        const capacity = row + 1;
        const line = player.pattern_lines[row];
        const line_colour = line.length > 0 ? line[0] : 0;

        // Empty slots first (right-to-left fill in Azul, but we show left to right)
        R.range(0, capacity).forEach(function (slot) {
            let slot_div;
            if (slot < line.length) {
                slot_div = make_tile(line_colour);
            } else {
                slot_div = make_empty_slot(`Row ${row + 1} slot ${slot + 1}`);
            }
            line_div.append(slot_div);
        });

        // Make the row clickable when this is the current player and a colour is selected.
        if (is_current && selection !== null) {
            const can_use = (
                (line_colour === 0 || line_colour === selection.colour) &&
                line.length < capacity &&
                !player.wall[row][Azul.wall_col_for_colour(selection.colour, row)]
            );

            if (can_use) {
                line_div.classList.add("valid_target");
                line_div.tabIndex = 0;
                line_div.setAttribute("role", "button");
                line_div.setAttribute("aria-label", `Place on row ${row + 1}`);

                const commit = function () {
                    apply_draft(row);
                };
                line_div.onclick = commit;
                line_div.onkeydown = function (event) {
                    if (event.key === "Enter" || event.key === " ") {
                        commit();
                    }
                };
            }
        }

        container.append(line_div);
    });

    // Floor-only button: send overflow straight to the floor.
    if (is_current && selection !== null) {
        const floor_btn = document.createElement("button");
        floor_btn.className = "floor_only_btn";
        floor_btn.textContent = "→ Floor only";
        floor_btn.setAttribute("aria-label", "Send all picked tiles to floor");
        floor_btn.onclick = function () {
            apply_draft(-1);
        };
        container.append(floor_btn);
    }
};

const render_wall = function (player_index) {
    const container = el(`player${player_index}_wall`);
    container.innerHTML = "";
    const wall = game_state.players[player_index].wall;

    R.range(0, 5).forEach(function (row) {
        R.range(0, 5).forEach(function (col) {
            const colour = Azul.wall_pattern[row][col];
            const filled = wall[row][col];
            const div = document.createElement("div");
            div.className = "wall_slot " + colour_class[colour] + (filled ? " filled" : " ghost");
            div.setAttribute("aria-label", `${colour_label[colour]} ${filled ? "placed" : "empty"}`);
            container.append(div);
        });
    });
};

const render_floor = function (player_index) {
    const container = el(`player${player_index}_floor`);
    container.innerHTML = "";
    const floor = game_state.players[player_index].floor;

    R.range(0, 7).forEach(function (i) {
        const slot = document.createElement("div");
        slot.className = "floor_slot";

        const penalty_label = document.createElement("span");
        penalty_label.className = "penalty";
        penalty_label.textContent = floor_penalty_labels[i];

        if (i < floor.length) {
            const tile_val = floor[i];
            const inner = document.createElement("div");
            inner.className = (
                tile_val === -1
                ? "tile " + marker_class
                : "tile " + colour_class[tile_val]
            );
            inner.setAttribute("aria-label", tile_val === -1 ? "First-player marker" : colour_label[tile_val]);
            slot.append(inner);
        } else {
            const empty = make_empty_slot("Floor slot " + (i + 1));
            slot.append(empty);
        }

        slot.append(penalty_label);
        container.append(slot);
    });
};

const render_turn_indicator = function () {
    const indicator = el("turn_indicator");
    if (Azul.is_ended(game_state)) {
        indicator.textContent = "Game over!";
        return;
    }
    const p = game_state.current_player;
    const name = el(`player${p}_name`).value || `Player ${p + 1}`;
    if (selection === null) {
        indicator.textContent = `${name}'s turn — pick a colour from a factory or the centre.`;
    } else {
        indicator.textContent = `${name} picked ${colour_label[selection.colour]} — choose a pattern line or send to floor.`;
    }
};

const render_all = function () {
    render_factories();
    render_centre();
    render_pattern_lines(0);
    render_pattern_lines(1);
    render_wall(0);
    render_wall(1);
    render_floor(0);
    render_floor(1);
    el("player0_score").textContent = game_state.players[0].score;
    el("player1_score").textContent = game_state.players[1].score;
    render_turn_indicator();

    // Highlight the active player's sidebar.
    el("player0_sidebar").classList.toggle("active_player", game_state.current_player === 0);
    el("player1_sidebar").classList.toggle("active_player", game_state.current_player === 1);
};

// -------------------------------------------------------------------------
// Game actions
// -------------------------------------------------------------------------

const apply_draft = function (pattern_line) {
    if (selection === null) {
        return;
    }

    let next_state;
    if (selection.source === "factory") {
        next_state = Azul.draft_from_factory(
            selection.factory_index,
            selection.colour,
            pattern_line,
            game_state
        );
    } else {
        next_state = Azul.draft_from_centre(
            selection.colour,
            pattern_line,
            game_state
        );
    }

    if (next_state === undefined) {
        return;
    }

    game_state = next_state;
    selection = null;
    render_all();

    if (Azul.is_ended(game_state)) {
        show_result();
    }
};

const show_result = function () {
    const winner = Azul.winner(game_state);
    const name0 = el("player0_name").value || "Player 1";
    const name1 = el("player1_name").value || "Player 2";
    const score0 = game_state.players[0].score;
    const score1 = game_state.players[1].score;

    let message;
    if (winner === 0) {
        message = `${name0} wins!`;
    } else if (winner === 1) {
        message = `${name1} wins!`;
    } else {
        message = "It's a draw!";
    }

    el("result_message").textContent = message;
    el("result_scores").textContent = `${name0}: ${score0} points — ${name1}: ${score1} points`;
    el("result_dialog").showModal();
};

el("play_again_btn").onclick = function () {
    game_state = Azul.new_game();
    selection = null;
    el("result_dialog").close();
    render_all();
};

el("result_dialog").onkeydown = function (event) {
    if (event.key === "Enter" || event.key === " ") {
        el("play_again_btn").click();
    }
};

// Load player names saved in Settings, if any.
el("player0_name").value = localStorage.getItem("azul_player0") || "Player 1";
el("player1_name").value = localStorage.getItem("azul_player1") || "Player 2";

// Keep player names editable without affecting game state.
el("player0_name").oninput = render_turn_indicator;
el("player1_name").oninput = render_turn_indicator;

// Initial render.
render_all();
