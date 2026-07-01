import Azul from "../Azul.js";
import R from "../ramda.js";

// Helper to display a wall in a readable format when a test fails.
const display_wall = function (wall) {
    return "\n" + Azul.wall_to_string(wall);
};

// Helper to display a full state as JSON.
const display_state = function (state) {
    return "\n" + JSON.stringify(state, null, 2);
};

// Build a blank player board where a specific wall position is already filled.
// Useful for testing score_for_placing without running a full game.
const wall_with = function (filled_positions) {
    const wall = R.range(0, 5).map(function () {
        return R.repeat(false, 5);
    });
    filled_positions.forEach(function ([r, c]) {
        wall[r][c] = true;
    });
    return wall;
};

// Construct a minimal game state for testing draft functions.
const state_with = function (overrides) {
    return {
        bag: R.repeat(10, 5),
        centre: [-1],
        current_player: 0,
        factories: [
            [1, 1, 2, 3],
            [2, 2, 4, 5],
            [3, 3, 1, 4],
            [4, 4, 5, 2],
            [5, 5, 3, 1]
        ],
        lid: R.repeat(0, 5),
        players: [
            {
                floor: [],
                pattern_lines: R.range(0, 5).map(function () {
                    return [];
                }),
                score: 0,
                wall: R.range(0, 5).map(function () {
                    return R.repeat(false, 5);
                })
            },
            {
                floor: [],
                pattern_lines: R.range(0, 5).map(function () {
                    return [];
                }),
                score: 0,
                wall: R.range(0, 5).map(function () {
                    return R.repeat(false, 5);
                })
            }
        ],
        round: 1,
        ...overrides
    };
};

// ---------------------------------------------------------------------------
// Wall column helper
// ---------------------------------------------------------------------------

describe("wall_col_for_colour", function () {
    it("Blue (colour 1) in row 0 belongs in column 0", function () {
        const col = Azul.wall_col_for_colour(1, 0);
        if (col !== 0) {
            throw new Error(`Expected column 0, got ${col}`);
        }
    });

    it("Yellow (colour 2) in row 0 belongs in column 1", function () {
        const col = Azul.wall_col_for_colour(2, 0);
        if (col !== 1) {
            throw new Error(`Expected column 1, got ${col}`);
        }
    });

    it("White (colour 5) in row 0 belongs in column 4", function () {
        const col = Azul.wall_col_for_colour(5, 0);
        if (col !== 4) {
            throw new Error(`Expected column 4, got ${col}`);
        }
    });

    it("White (colour 5) in row 1 belongs in column 0", function () {
        const col = Azul.wall_col_for_colour(5, 1);
        if (col !== 0) {
            throw new Error(`Expected column 0, got ${col}`);
        }
    });

    it("Each colour appears exactly once per row in the wall pattern", function () {
        R.range(0, 5).forEach(function (row) {
            const cols = R.range(1, 6).map(function (colour) {
                return Azul.wall_col_for_colour(colour, row);
            });
            const unique_cols = R.uniq(cols);
            if (unique_cols.length !== 5) {
                throw new Error(
                    `Row ${row} does not have all 5 colours in distinct columns. ` +
                    `Columns: ${JSON.stringify(cols)}`
                );
            }
        });
    });
});

// ---------------------------------------------------------------------------
// Tile placement scoring
// ---------------------------------------------------------------------------

describe("score_for_placing", function () {
    it(
        `Given an empty wall,
When a tile is placed anywhere,
Then it scores exactly 1 point.`,
        function () {
            const empty_wall = R.range(0, 5).map(function () {
                return R.repeat(false, 5);
            });
            R.range(0, 5).forEach(function (row) {
                R.range(0, 5).forEach(function (col) {
                    const score = Azul.score_for_placing(row, col, empty_wall);
                    if (score !== 1) {
                        throw new Error(
                            `Expected score 1 at (${row},${col}), got ${score}`
                        );
                    }
                });
            });
        }
    );

    it(
        `Given a wall with one neighbour to the left,
When a tile is placed to its right,
Then it scores 2 (the run of 2 horizontally).`,
        function () {
            const wall = wall_with([[2, 0]]);
            const score = Azul.score_for_placing(2, 1, wall);
            if (score !== 2) {
                throw new Error(
                    `Expected score 2, got ${score}${display_wall(wall)}`
                );
            }
        }
    );

    it(
        `Given a wall with tiles in a horizontal run of 3,
When a tile extends it to a run of 4,
Then it scores 4.`,
        function () {
            const wall = wall_with([[1, 0], [1, 1], [1, 2]]);
            const score = Azul.score_for_placing(1, 3, wall);
            if (score !== 4) {
                throw new Error(
                    `Expected score 4, got ${score}${display_wall(wall)}`
                );
            }
        }
    );

    it(
        `Given a wall with one tile directly above and one to the left,
When a tile is placed at their corner,
Then it scores the horizontal run plus the vertical run.`,
        function () {
            // Wall has [0][2] and [2][3] filled; place at [1][2] which is adjacent above and below
            const wall = wall_with([[0, 2], [2, 2], [1, 3]]);
            // Placing at (1,2): up=1, down=1, right=1 → v_score=3, h_score=2 → total 5
            const score = Azul.score_for_placing(1, 2, wall);
            if (score !== 5) {
                throw new Error(
                    `Expected score 5, got ${score}${display_wall(wall)}`
                );
            }
        }
    );

    it(
        `Given a wall with a tile directly above,
When a tile is placed below it,
Then it scores 2 (the vertical run only).`,
        function () {
            const wall = wall_with([[0, 0]]);
            const score = Azul.score_for_placing(1, 0, wall);
            if (score !== 2) {
                throw new Error(
                    `Expected score 2, got ${score}${display_wall(wall)}`
                );
            }
        }
    );
});

// ---------------------------------------------------------------------------
// End-game bonus
// ---------------------------------------------------------------------------

describe("end_game_bonus", function () {
    it("An empty wall earns no bonus points", function () {
        const empty_wall = R.range(0, 5).map(function () {
            return R.repeat(false, 5);
        });
        const bonus = Azul.end_game_bonus(empty_wall);
        if (bonus !== 0) {
            throw new Error(`Expected 0 bonus points, got ${bonus}`);
        }
    });

    it("A single complete horizontal row earns +2", function () {
        const wall = R.range(0, 5).map(function () {
            return R.repeat(false, 5);
        });
        wall[0] = R.repeat(true, 5);
        const bonus = Azul.end_game_bonus(wall);
        if (bonus !== 2) {
            throw new Error(`Expected +2 bonus, got ${bonus}${display_wall(wall)}`);
        }
    });

    it("Two complete rows earn +4", function () {
        const wall = R.range(0, 5).map(function () {
            return R.repeat(false, 5);
        });
        wall[0] = R.repeat(true, 5);
        wall[3] = R.repeat(true, 5);
        const bonus = Azul.end_game_bonus(wall);
        if (bonus !== 4) {
            throw new Error(`Expected +4 bonus, got ${bonus}${display_wall(wall)}`);
        }
    });

    it("A single complete vertical column earns +7", function () {
        const wall = R.range(0, 5).map(function (row) {
            return R.range(0, 5).map(function (col) {
                return col === 0;
            });
        });
        const bonus = Azul.end_game_bonus(wall);
        if (bonus !== 7) {
            throw new Error(`Expected +7 bonus, got ${bonus}${display_wall(wall)}`);
        }
    });

    it(
        `When all five tiles of one colour appear on the wall,
Then that colour earns +10 bonus points.`,
        function () {
            // Blue (colour 1) appears at wall_col_for_colour(1, row) for each row
            const wall = R.range(0, 5).map(function () {
                return R.repeat(false, 5);
            });
            R.range(0, 5).forEach(function (row) {
                const col = Azul.wall_col_for_colour(1, row);
                wall[row][col] = true;
            });
            const bonus = Azul.end_game_bonus(wall);
            if (bonus !== 10) {
                throw new Error(`Expected +10 bonus, got ${bonus}${display_wall(wall)}`);
            }
        }
    );
});

// ---------------------------------------------------------------------------
// Game state: new game
// ---------------------------------------------------------------------------

describe("new_game", function () {
    it("A new game starts at round 1", function () {
        const state = Azul.new_game();
        if (state.round !== 1) {
            throw new Error(`Expected round 1, got ${state.round}`);
        }
    });

    it("A new game has exactly 5 factory displays", function () {
        const state = Azul.new_game();
        if (state.factories.length !== 5) {
            throw new Error(
                `Expected 5 factories, got ${state.factories.length}`
            );
        }
    });

    it("Each factory display starts with exactly 4 tiles", function () {
        const state = Azul.new_game();
        state.factories.forEach(function (factory, i) {
            if (factory.length !== 4) {
                throw new Error(
                    `Factory ${i} has ${factory.length} tiles, expected 4`
                );
            }
        });
    });

    it("All factory tiles are valid colours (1–5)", function () {
        const state = Azul.new_game();
        const all_tiles = state.factories.flat();
        const invalid = all_tiles.filter(function (t) {
            return t < 1 || t > 5;
        });
        if (invalid.length > 0) {
            throw new Error(`Found invalid tile values: ${JSON.stringify(invalid)}`);
        }
    });

    it("A new game is in the drafting phase", function () {
        const state = Azul.new_game();
        if (!Azul.is_drafting(state)) {
            throw new Error(
                `A new game should be in the drafting phase${display_state(state)}`
            );
        }
    });

    it("A new game is not ended", function () {
        const state = Azul.new_game();
        if (Azul.is_ended(state)) {
            throw new Error(
                `A new game should not be ended${display_state(state)}`
            );
        }
    });

    it("Both player boards start with a score of 0", function () {
        const state = Azul.new_game();
        state.players.forEach(function (player, i) {
            if (player.score !== 0) {
                throw new Error(`Player ${i} starts with score ${player.score}, expected 0`);
            }
        });
    });

    it("Both player boards start with all pattern lines empty", function () {
        const state = Azul.new_game();
        state.players.forEach(function (player, i) {
            player.pattern_lines.forEach(function (line, row) {
                if (line.length !== 0) {
                    throw new Error(
                        `Player ${i} pattern line ${row} is not empty at game start`
                    );
                }
            });
        });
    });
});

// ---------------------------------------------------------------------------
// Drafting: factory
// ---------------------------------------------------------------------------

describe("draft_from_factory", function () {
    it(
        `Given a factory with tiles of colour 1,
When player 0 drafts colour 1 onto pattern line 0,
Then the resulting state has that colour on line 0 and the factory is empty.`,
        function () {
            const state = state_with({
                factories: [[1, 1, 2, 3], [2, 2, 4, 5], [3, 3, 1, 4], [4, 4, 5, 2], [5, 5, 3, 1]]
            });
            const next = Azul.draft_from_factory(0, 1, 0, state);
            if (next === undefined) {
                throw new Error("Expected a valid move, got undefined");
            }
            const line = next.players[0].pattern_lines[0];
            if (line.length === 0 || line[0] !== 1) {
                throw new Error(
                    `Expected pattern line 0 to contain colour 1, got ${JSON.stringify(line)}`
                );
            }
            if (next.factories[0].length !== 0) {
                throw new Error(
                    `Expected factory 0 to be empty after drafting, got ${JSON.stringify(next.factories[0])}`
                );
            }
        }
    );

    it(
        `Given a factory with tiles,
When the non-chosen tiles are left over,
Then they appear in the centre pool.`,
        function () {
            const state = state_with({
                factories: [[1, 1, 2, 3], [2, 2, 4, 5], [3, 3, 1, 4], [4, 4, 5, 2], [5, 5, 3, 1]]
            });
            const centre_before = state.centre.filter(function (t) {
                return t > 0;
            }).length;
            // Taking colour 1 from factory 0 leaves tiles [2, 3] in the centre.
            const next = Azul.draft_from_factory(0, 1, 0, state);
            if (next === undefined) {
                throw new Error("Expected a valid move, got undefined");
            }
            const centre_real_tiles = next.centre.filter(function (t) {
                return t > 0;
            }).length;
            if (centre_real_tiles !== centre_before + 2) {
                throw new Error(
                    `Expected centre to grow by 2, but centre has ${centre_real_tiles} real tiles` +
                    ` (was ${centre_before})`
                );
            }
        }
    );

    it(
        `Given a request to draft a colour not present in the factory,
When the move is attempted,
Then undefined is returned.`,
        function () {
            // Factory 0 is [1,1,2,3]; colour 5 is not present.
            const state = state_with({});
            const next = Azul.draft_from_factory(0, 5, 0, state);
            if (next !== undefined) {
                throw new Error(
                    "Expected undefined for an illegal draft, got a state"
                );
            }
        }
    );

    it(
        `Given a pattern line that already holds a different colour,
When a player tries to place a different colour on it,
Then undefined is returned.`,
        function () {
            const state = state_with({
                players: [
                    {
                        floor: [],
                        pattern_lines: [[2], [], [], [], []],   // line 0 holds Yellow
                        score: 0,
                        wall: R.range(0, 5).map(function () {
                            return R.repeat(false, 5);
                        })
                    },
                    {
                        floor: [],
                        pattern_lines: R.range(0, 5).map(function () {
                            return [];
                        }),
                        score: 0,
                        wall: R.range(0, 5).map(function () {
                            return R.repeat(false, 5);
                        })
                    }
                ]
            });
            // Colour 1 (Blue) onto line 0 which already has Yellow
            const next = Azul.draft_from_factory(0, 1, 0, state);
            if (next !== undefined) {
                throw new Error("Expected undefined when placing wrong colour on a line");
            }
        }
    );

    it(
        `When tiles drafted from a factory exceed the pattern line capacity,
Then the excess tiles go to the floor line.`,
        function () {
            // Pattern line 0 has capacity 1. Factory 0 has two Blue tiles.
            const state = state_with({
                factories: [[1, 1, 2, 3], [2, 2, 4, 5], [3, 3, 1, 4], [4, 4, 5, 2], [5, 5, 3, 1]]
            });
            const next = Azul.draft_from_factory(0, 1, 0, state);
            if (next === undefined) {
                throw new Error("Expected a valid move, got undefined");
            }
            // Two Blue taken; line 0 holds 1; second Blue overflows to floor.
            const floor = next.players[0].floor;
            if (floor.length === 0) {
                throw new Error(
                    "Expected overflow tile on floor, but floor is empty"
                );
            }
        }
    );

    it(
        `Given a completed game (is_ended returns true),
When a draft is attempted,
Then undefined is returned.`,
        function () {
            // Build a state where row 0 of player 0 is fully tiled.
            const complete_wall = R.range(0, 5).map(function () {
                return R.repeat(false, 5);
            });
            complete_wall[0] = R.repeat(true, 5);
            const state = state_with({
                players: [
                    {
                        floor: [],
                        pattern_lines: R.range(0, 5).map(function () {
                            return [];
                        }),
                        score: 10,
                        wall: complete_wall
                    },
                    {
                        floor: [],
                        pattern_lines: R.range(0, 5).map(function () {
                            return [];
                        }),
                        score: 0,
                        wall: R.range(0, 5).map(function () {
                            return R.repeat(false, 5);
                        })
                    }
                ]
            });
            if (!Azul.is_ended(state)) {
                throw new Error("Test setup error: state should be ended");
            }
            const next = Azul.draft_from_factory(0, 1, 0, state);
            if (next !== undefined) {
                throw new Error("Expected undefined when drafting after game has ended");
            }
        }
    );
});

// ---------------------------------------------------------------------------
// Drafting: centre
// ---------------------------------------------------------------------------

describe("draft_from_centre", function () {
    it(
        `Given tiles of a colour in the centre,
When a player drafts that colour,
Then those tiles are removed from the centre.`,
        function () {
            const state = state_with({
                centre: [-1, 2, 2, 3],
                factories: R.range(0, 5).map(function () {
                    return [];
                })
            });
            const next = Azul.draft_from_centre(2, 1, state);
            if (next === undefined) {
                throw new Error("Expected a valid move, got undefined");
            }
            const remaining = next.centre.filter(function (t) {
                return t === 2;
            });
            if (remaining.length !== 0) {
                throw new Error(
                    `Expected all Yellow tiles removed from centre, ` +
                    `but ${remaining.length} remain`
                );
            }
        }
    );

    it(
        `Given the first-player marker is still in the centre,
When a player drafts from the centre,
Then the marker moves to that player's floor.`,
        function () {
            // Keep one factory with tiles so the round does not end immediately,
            // letting us inspect the floor before end-of-round processing clears it.
            const state = state_with({
                centre: [-1, 3, 3],
                factories: [[2, 2, 2, 2], [], [], [], []]
            });
            const next = Azul.draft_from_centre(3, 0, state);
            if (next === undefined) {
                throw new Error("Expected a valid move, got undefined");
            }
            // After the draft the round is still ongoing, so the floor is not yet cleared.
            const other = 1 - state.current_player;
            const has_marker = next.players[state.current_player].floor.includes(-1);
            if (!has_marker) {
                throw new Error(
                    `Expected first-player marker on player ${state.current_player}'s floor ` +
                    `after drafting from centre, floor was: ` +
                    JSON.stringify(next.players[state.current_player].floor)
                );
            }
        }
    );

    it(
        `Given a colour not present in the centre,
When a player tries to draft it,
Then undefined is returned.`,
        function () {
            const state = state_with({
                centre: [-1, 2, 2],
                factories: R.range(0, 5).map(function () {
                    return [];
                })
            });
            const next = Azul.draft_from_centre(5, 0, state);
            if (next !== undefined) {
                throw new Error("Expected undefined for colour absent from centre");
            }
        }
    );
});

// ---------------------------------------------------------------------------
// is_ended
// ---------------------------------------------------------------------------

describe("is_ended", function () {
    it(
        `A state where no player has a complete row on their wall is not ended.`,
        function () {
            const state = state_with({});
            if (Azul.is_ended(state)) {
                throw new Error("Expected game not ended, but is_ended returned true");
            }
        }
    );

    it(
        `A state where player 0 has all five tiles in row 2 of the wall is ended.`,
        function () {
            const wall = R.range(0, 5).map(function () {
                return R.repeat(false, 5);
            });
            wall[2] = R.repeat(true, 5);
            const state = state_with({
                players: [
                    {
                        floor: [],
                        pattern_lines: R.range(0, 5).map(function () {
                            return [];
                        }),
                        score: 0,
                        wall
                    },
                    {
                        floor: [],
                        pattern_lines: R.range(0, 5).map(function () {
                            return [];
                        }),
                        score: 0,
                        wall: R.range(0, 5).map(function () {
                            return R.repeat(false, 5);
                        })
                    }
                ]
            });
            if (!Azul.is_ended(state)) {
                throw new Error(
                    `Expected game to be ended with a complete row${display_wall(wall)}`
                );
            }
        }
    );
});

// ---------------------------------------------------------------------------
// winner
// ---------------------------------------------------------------------------

describe("winner", function () {
    it("The player with the higher score wins", function () {
        const state = state_with({
            players: [
                {
                    floor: [],
                    pattern_lines: R.range(0, 5).map(function () {
                        return [];
                    }),
                    score: 42,
                    wall: R.range(0, 5).map(function () {
                        return R.repeat(false, 5);
                    })
                },
                {
                    floor: [],
                    pattern_lines: R.range(0, 5).map(function () {
                        return [];
                    }),
                    score: 35,
                    wall: R.range(0, 5).map(function () {
                        return R.repeat(false, 5);
                    })
                }
            ]
        });
        const w = Azul.winner(state);
        if (w !== 0) {
            throw new Error(`Expected player 0 to win with score 42 vs 35, got winner ${w}`);
        }
    });

    it("When player 1 has the higher score, player 1 wins", function () {
        const state = state_with({
            players: [
                {
                    floor: [],
                    pattern_lines: R.range(0, 5).map(function () {
                        return [];
                    }),
                    score: 18,
                    wall: R.range(0, 5).map(function () {
                        return R.repeat(false, 5);
                    })
                },
                {
                    floor: [],
                    pattern_lines: R.range(0, 5).map(function () {
                        return [];
                    }),
                    score: 30,
                    wall: R.range(0, 5).map(function () {
                        return R.repeat(false, 5);
                    })
                }
            ]
        });
        const w = Azul.winner(state);
        if (w !== 1) {
            throw new Error(`Expected player 1 to win with score 30 vs 18, got winner ${w}`);
        }
    });

    it("Equal scores with equal rows returns −1 (draw)", function () {
        const state = state_with({
            players: [
                {
                    floor: [],
                    pattern_lines: R.range(0, 5).map(function () {
                        return [];
                    }),
                    score: 20,
                    wall: R.range(0, 5).map(function () {
                        return R.repeat(false, 5);
                    })
                },
                {
                    floor: [],
                    pattern_lines: R.range(0, 5).map(function () {
                        return [];
                    }),
                    score: 20,
                    wall: R.range(0, 5).map(function () {
                        return R.repeat(false, 5);
                    })
                }
            ]
        });
        const w = Azul.winner(state);
        if (w !== -1) {
            throw new Error(`Expected draw (−1), got winner ${w}`);
        }
    });
});
