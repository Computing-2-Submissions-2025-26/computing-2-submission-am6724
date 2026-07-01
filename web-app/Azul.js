import R from "./ramda.js";
/**
 * Azul.js is a module to model and play the tile-drafting board game Azul.
 * Players take turns drafting coloured tiles from factory displays into
 * their pattern lines. Completed rows score points and decorate their wall.
 * The game ends when any player completes a full horizontal row on the wall.
 * https://en.wikipedia.org/wiki/Azul_(board_game)
 * @namespace Azul
 * @author Aliza Mumtaz
 * @version 2026
 */
const Azul = Object.create(null);

// Tile colours are represented as numbers 1–5.
// 0 means empty; -1 is the first-player marker (not a real tile).

/**
 * A colour value representing one of the five Azul tile colours.
 * @memberof Azul
 * @typedef {(1 | 2 | 3 | 4 | 5)} Colour
 */

/**
 * Human-readable names for each colour value.
 * @memberof Azul
 * @enum {string}
 */
Azul.colour_names = Object.freeze({
    1: "Blue",
    2: "Yellow",
    3: "Red",
    4: "Black",
    5: "White"
});

/**
 * The floor line penalty values from left to right.
 * Tiles in positions beyond index 6 each incur a −3 penalty.
 * @memberof Azul
 * @type {number[]}
 */
Azul.floor_penalties = Object.freeze([-1, -1, -2, -2, -2, -3, -3]);

/**
 * The fixed wall colour pattern for Azul.
 * `wall_pattern[row][col]` gives the colour that belongs at that position.
 * Each colour appears exactly once per row and once per column.
 * @memberof Azul
 * @type {number[][]}
 */
Azul.wall_pattern = Object.freeze(
    R.range(0, 5).map(function (row) {
        return R.range(0, 5).map(function (col) {
            return ((col - row + 5) % 5) + 1;
        });
    })
);

/**
 * Returns the column index on the wall where a colour belongs in a given row.
 * @memberof Azul
 * @function
 * @param {Azul.Colour} colour The tile colour (1–5).
 * @param {number} row The wall row (0–4).
 * @returns {number} The wall column index (0–4) for that colour.
 */
Azul.wall_col_for_colour = function (colour, row) {
    return (colour - 1 + row) % 5;
};

/**
 * A player's board containing everything they own during the game.
 * @memberof Azul
 * @typedef {Object} PlayerBoard
 * @property {number[][]} pattern_lines Five rows; row `i` holds at most `i + 1`
 *   tiles, all of the same colour.
 * @property {boolean[][]} wall A 5 × 5 grid; `true` where a tile has been placed.
 * @property {number[]} floor Tiles on the floor line (incur penalties at round end).
 *   The first-player marker is stored here as `−1`.
 * @property {number} score The player's running score (never drops below 0).
 */

/**
 * A complete snapshot of an Azul game, sufficient to resume play at any point.
 * @memberof Azul
 * @typedef {Object} State
 * @property {number[]} bag Remaining tile counts indexed by colour − 1.
 * @property {number[]} lid Discarded tile counts (used to refill the bag).
 * @property {number[][]} factories The five factory displays, each an array of tiles.
 * @property {number[]} centre Tiles in the centre pool; `−1` is the first-player marker.
 * @property {Azul.PlayerBoard[]} players The two player boards.
 * @property {number} current_player Index (0 or 1) of the player whose turn it is.
 * @property {number} round The current round number, starting at 1.
 */

const empty_player_board = function () {
    return {
        floor: [],
        pattern_lines: R.range(0, 5).map(function () {
            return [];
        }),
        score: 0,
        wall: R.range(0, 5).map(function () {
            return R.repeat(false, 5);
        })
    };
};

const factories_per_game = 5;

/**
 * Draw one tile at random from the bag (refilling from the lid if necessary).
 * Returns the chosen colour and the updated bag and lid.
 * @function
 * @param {number[]} bag Tile counts in the bag.
 * @param {number[]} lid Tile counts in the lid.
 * @returns {{ colour: number, bag: number[], lid: number[] } | null}
 *   The drawn colour and updated counts, or `null` if both are empty.
 */
const draw_one_tile = function (bag, lid) {
    let current_bag = [...bag];
    let current_lid = [...lid];

    if (R.sum(current_bag) === 0) {
        current_bag = [...current_lid];
        current_lid = R.repeat(0, 5);
    }

    const total = R.sum(current_bag);
    if (total === 0) {
        return null;
    }

    const pick = Math.floor(Math.random() * total);
    let cumulative = 0;
    let chosen_colour = -1;

    R.range(0, 5).some(function (i) {
        cumulative += current_bag[i];
        if (pick < cumulative) {
            chosen_colour = i + 1;
            current_bag = R.update(i, current_bag[i] - 1, current_bag);
            return true;
        }
        return false;
    });

    return {
        bag: current_bag,
        colour: chosen_colour,
        lid: current_lid
    };
};

/**
 * Deal tiles onto all factory displays at the start of a new round.
 * Each factory receives 4 tiles drawn at random from the bag.
 * @function
 * @param {number[]} bag Tile counts in the bag.
 * @param {number[]} lid Tile counts in the lid.
 * @returns {{ bag: number[], lid: number[], factories: number[][] }}
 *   Updated bag, lid, and the newly filled factory displays.
 */
const deal_factories = function (bag, lid) {
    let running_bag = [...bag];
    let running_lid = [...lid];
    const factories = [];

    R.range(0, factories_per_game).forEach(function () {
        const factory = [];
        R.range(0, 4).forEach(function () {
            const result = draw_one_tile(running_bag, running_lid);
            if (result === null) {
                return;
            }
            factory.push(result.colour);
            running_bag = result.bag;
            running_lid = result.lid;
        });
        factories.push(factory);
    });

    return {
        bag: running_bag,
        factories,
        lid: running_lid
    };
};

/**
 * Create a new Azul game for two players and deal the first round of tiles.
 * @memberof Azul
 * @function
 * @returns {Azul.State} The initial game state.
 */
Azul.new_game = function () {
    const full_bag = R.repeat(20, 5);
    const empty_lid = R.repeat(0, 5);
    const dealt = deal_factories(full_bag, empty_lid);
    return {
        bag: dealt.bag,
        centre: [-1],
        current_player: 0,
        factories: dealt.factories,
        lid: dealt.lid,
        players: [empty_player_board(), empty_player_board()],
        round: 1
    };
};

/**
 * Returns whether the drafting phase of the current round is still in progress.
 * Drafting ends when every factory is empty and the centre holds no real tiles.
 * @memberof Azul
 * @function
 * @param {Azul.State} state The current game state.
 * @returns {boolean} `true` while there are still tiles left to draft.
 */
Azul.is_drafting = function (state) {
    const factories_have_tiles = state.factories.some(function (f) {
        return f.length > 0;
    });
    const centre_has_tiles = state.centre.some(function (t) {
        return t > 0;
    });
    return factories_have_tiles || centre_has_tiles;
};

/**
 * Returns whether the game has ended.
 * The game ends after a tiling phase in which any player has at least one
 * complete horizontal row on their wall.
 * @memberof Azul
 * @function
 * @param {Azul.State} state The current game state.
 * @returns {boolean} `true` if the game is over.
 */
Azul.is_ended = function (state) {
    return state.players.some(function (player) {
        return player.wall.some(function (row) {
            return row.every(Boolean);
        });
    });
};

/**
 * Returns the score earned by placing a tile at `(row, col)` on the given wall.
 * A tile scores 1 on its own; if it extends a horizontal or vertical run,
 * the whole run (including itself) scores once per direction it extends.
 * @memberof Azul
 * @function
 * @param {number} row The row index (0–4).
 * @param {number} col The column index (0–4).
 * @param {boolean[][]} wall The wall state at the moment of placement.
 * @returns {number} Points earned for this placement.
 */
Azul.score_for_placing = function (row, col, wall) {
    const count_run = function (dr, dc) {
        let n = 0;
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < 5 && c >= 0 && c < 5 && wall[r][c]) {
            n += 1;
            r += dr;
            c += dc;
        }
        return n;
    };

    const left = count_run(0, -1);
    const right = count_run(0, 1);
    const up = count_run(-1, 0);
    const down = count_run(1, 0);

    const h_run = left + right;
    const v_run = up + down;

    const h_score = h_run > 0 ? h_run + 1 : 0;
    const v_score = v_run > 0 ? v_run + 1 : 0;

    if (h_score === 0 && v_score === 0) {
        return 1;
    }
    return h_score + v_score;
};

/**
 * Returns the end-game bonus points for a finished wall.
 * Awards +2 for each complete horizontal row, +7 for each complete vertical
 * column, and +10 for each colour whose five tiles all appear on the wall.
 * @memberof Azul
 * @function
 * @param {boolean[][]} wall The completed wall to evaluate.
 * @returns {number} The total bonus points earned.
 */
Azul.end_game_bonus = function (wall) {
    const row_bonus = wall.filter(function (row) {
        return row.every(Boolean);
    }).length * 2;

    const col_bonus = R.range(0, 5).filter(function (col) {
        return wall.every(function (row) {
            return row[col];
        });
    }).length * 7;

    const colour_bonus = R.range(0, 5).filter(function (colour_index) {
        const colour = colour_index + 1;
        return R.range(0, 5).every(function (row) {
            const col = Azul.wall_col_for_colour(colour, row);
            return wall[row][col];
        });
    }).length * 10;

    return row_bonus + col_bonus + colour_bonus;
};

/**
 * Returns the index of the winning player, or −1 if the scores are tied.
 * Should only be called once {@link Azul.is_ended} returns `true`.
 * In a tie, the player with more complete horizontal rows wins;
 * if still tied, the lower-indexed player is declared the winner.
 * @memberof Azul
 * @function
 * @param {Azul.State} state The final game state.
 * @returns {(0 | 1 | -1)} Index of the winner, or −1 for a draw.
 */
Azul.winner = function (state) {
    const score_a = state.players[0].score;
    const score_b = state.players[1].score;
    if (score_a > score_b) {
        return 0;
    }
    if (score_b > score_a) {
        return 1;
    }
    const rows_a = state.players[0].wall.filter(function (row) {
        return row.every(Boolean);
    }).length;
    const rows_b = state.players[1].wall.filter(function (row) {
        return row.every(Boolean);
    }).length;
    if (rows_a > rows_b) {
        return 0;
    }
    if (rows_b > rows_a) {
        return 1;
    }
    return -1;
};

/**
 * Returns a human-readable text representation of a wall, useful for debugging.
 * Filled positions show the colour initial; empty positions show a dot.
 * @memberof Azul
 * @function
 * @param {boolean[][]} wall The wall to display.
 * @returns {string} A multi-line string representation.
 */
Azul.wall_to_string = function (wall) {
    const initials = [".", "B", "Y", "R", "K", "W"];
    return wall.map(function (row, r) {
        return row.map(function (filled, c) {
            return filled ? initials[Azul.wall_pattern[r][c]] : ".";
        }).join(" ");
    }).join("\n");
};

/**
 * Carry out the end-of-round tiling for one player board.
 * Each completed pattern line scores, places its tile on the wall, and sends
 * the extra tiles to the lid. Incomplete lines are left as they are.
 * The floor line is then scored and cleared.
 * @function
 * @param {Azul.PlayerBoard} player The board to process.
 * @param {number[]} lid The current lid counts.
 * @returns {{ player: Azul.PlayerBoard, lid: number[] }}
 *   The updated player board and lid.
 */
const tile_player_board = function (player, lid) {
    let new_wall = player.wall.map(function (row) {
        return [...row];
    });
    let running_score = player.score;
    let running_lid = [...lid];

    const new_pattern_lines = player.pattern_lines.map(function (line, row) {
        const capacity = row + 1;
        if (line.length < capacity) {
            return line;
        }
        const colour = line[0];
        const col = Azul.wall_col_for_colour(colour, row);
        new_wall[row][col] = true;
        running_score += Azul.score_for_placing(row, col, new_wall);
        running_lid = R.update(colour - 1, running_lid[colour - 1] + (line.length - 1), running_lid);
        return [];
    });

    const floor_penalty = player.floor.reduce(function (total, _tile, i) {
        return total + (Azul.floor_penalties[i] || -3);
    }, 0);

    running_score = Math.max(0, running_score + floor_penalty);

    player.floor.forEach(function (tile) {
        if (tile > 0) {
            running_lid = R.update(tile - 1, running_lid[tile - 1] + 1, running_lid);
        }
    });

    return {
        lid: running_lid,
        player: {
            floor: [],
            pattern_lines: new_pattern_lines,
            score: running_score,
            wall: new_wall
        }
    };
};

/**
 * Validate whether a pattern line can accept tiles of a given colour.
 * Returns `false` if the line already holds a different colour, is full,
 * or if that colour has already been placed on the wall in that row.
 * @function
 * @param {number} line_index The pattern line index (0–4).
 * @param {Azul.Colour} colour The colour to place.
 * @param {Azul.PlayerBoard} player The player's board.
 * @returns {boolean} `true` if the line can accept the colour.
 */
const can_place_on_line = function (line_index, colour, player) {
    const line = player.pattern_lines[line_index];
    const capacity = line_index + 1;
    if (line.length >= capacity) {
        return false;
    }
    if (line.length > 0 && line[0] !== colour) {
        return false;
    }
    const wall_col = Azul.wall_col_for_colour(colour, line_index);
    if (player.wall[line_index][wall_col]) {
        return false;
    }
    return true;
};

/**
 * Internal helper that distributes tiles to a pattern line and any overflow to the floor.
 * Then advances to the next player's turn or triggers end-of-round tiling.
 * @function
 * @param {number[]} tiles Tiles to place (may contain −1 for the first-player marker).
 * @param {number} pattern_line Pattern line index (0–4), or −1 to send all to the floor.
 * @param {number[][]} new_factories Updated factory displays.
 * @param {number[]} new_centre Updated centre pool.
 * @param {Azul.State} state The state before the draft.
 * @returns {Azul.State} The resulting state after the move (and tiling if applicable).
 */
const place_tiles = function (tiles, pattern_line, new_factories, new_centre, state) {
    const p = state.current_player;
    const player = state.players[p];
    let new_pattern_lines = player.pattern_lines.map(function (l) {
        return [...l];
    });
    let new_floor = [...player.floor];

    tiles.forEach(function (tile) {
        if (tile === -1) {
            new_floor.push(-1);
            return;
        }
        if (pattern_line === -1) {
            new_floor.push(tile);
            return;
        }
        const capacity = pattern_line + 1;
        if (new_pattern_lines[pattern_line].length < capacity) {
            new_pattern_lines[pattern_line] = [...new_pattern_lines[pattern_line], tile];
        } else {
            new_floor.push(tile);
        }
    });

    if (new_floor.length > 7) {
        new_floor = new_floor.slice(0, 7);
    }

    const new_players = R.update(p, {
        ...player,
        floor: new_floor,
        pattern_lines: new_pattern_lines
    }, state.players);

    const after_draft = {
        ...state,
        centre: new_centre,
        current_player: 1 - p,
        factories: new_factories,
        players: new_players
    };

    if (Azul.is_drafting(after_draft)) {
        return after_draft;
    }
    return end_round(after_draft);
};

/**
 * Process the end of a drafting round for all players, then either start the
 * next round or apply end-game bonuses if the game is over.
 * @function
 * @param {Azul.State} state The state at the end of drafting.
 * @returns {Azul.State} The state at the start of the next round, or the final state.
 */
const end_round = function (state) {
    const marker_holder = state.players.findIndex(function (player) {
        return player.floor.includes(-1);
    });
    const next_starter = marker_holder >= 0 ? marker_holder : 0;

    let running_lid = [...state.lid];
    const new_players = state.players.map(function (player) {
        const result = tile_player_board(player, running_lid);
        running_lid = result.lid;
        return result.player;
    });

    const after_tiling = {
        ...state,
        lid: running_lid,
        players: new_players
    };

    if (Azul.is_ended(after_tiling)) {
        return {
            ...after_tiling,
            players: new_players.map(function (p) {
                return {
                    ...p,
                    score: p.score + Azul.end_game_bonus(p.wall)
                };
            })
        };
    }

    const dealt = deal_factories(after_tiling.bag, after_tiling.lid);
    return {
        ...after_tiling,
        bag: dealt.bag,
        centre: [-1],
        current_player: next_starter,
        factories: dealt.factories,
        lid: dealt.lid,
        round: state.round + 1
    };
};

/**
 * Draft all tiles of a given colour from a factory display.
 * The remaining tiles from that factory move to the centre.
 * The chosen tiles fill the specified pattern line from left to right;
 * any that do not fit overflow to the floor line.
 * @memberof Azul
 * @function
 * @param {number} factory_index Index of the factory to draft from (0–4).
 * @param {Azul.Colour} colour The colour to take.
 * @param {number} pattern_line Pattern line index to fill (0–4), or −1 for floor only.
 * @param {Azul.State} state The current game state.
 * @returns {(Azul.State | undefined)} The new state, or `undefined` if the move is illegal.
 */
Azul.draft_from_factory = function (factory_index, colour, pattern_line, state) {
    if (!Azul.is_drafting(state)) {
        return undefined;
    }
    const factory = state.factories[factory_index];
    if (factory === undefined || !factory.includes(colour)) {
        return undefined;
    }
    if (pattern_line !== -1) {
        if (!can_place_on_line(pattern_line, colour, state.players[state.current_player])) {
            return undefined;
        }
    }

    const picked = factory.filter(function (t) {
        return t === colour;
    });
    const leftover = factory.filter(function (t) {
        return t !== colour;
    });
    const new_factories = R.update(factory_index, [], state.factories);
    const new_centre = [...state.centre, ...leftover];

    return place_tiles(picked, pattern_line, new_factories, new_centre, state);
};

/**
 * Draft all tiles of a given colour from the centre pool.
 * If the first-player marker is still in the centre, it moves to the current
 * player's floor (costing a penalty but granting the first turn next round).
 * @memberof Azul
 * @function
 * @param {Azul.Colour} colour The colour to take.
 * @param {number} pattern_line Pattern line index to fill (0–4), or −1 for floor only.
 * @param {Azul.State} state The current game state.
 * @returns {(Azul.State | undefined)} The new state, or `undefined` if the move is illegal.
 */
Azul.draft_from_centre = function (colour, pattern_line, state) {
    if (!Azul.is_drafting(state)) {
        return undefined;
    }
    if (!state.centre.includes(colour)) {
        return undefined;
    }
    if (pattern_line !== -1) {
        if (!can_place_on_line(pattern_line, colour, state.players[state.current_player])) {
            return undefined;
        }
    }

    const has_marker = state.centre.includes(-1);
    const picked = state.centre.filter(function (t) {
        return t === colour;
    });
    const new_centre = state.centre.filter(function (t) {
        return t !== colour && t !== -1;
    });

    const tiles_to_place = has_marker ? [-1, ...picked] : picked;
    return place_tiles(tiles_to_place, pattern_line, state.factories, new_centre, state);
};

export default Object.freeze(Azul);
