const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const chess = require('./chess.js');

const app = express();

const PORT = 3000;

const MAX_ACTIVE_GAMES = 35;

const DATA_DIR =
    path.join(__dirname, 'data');

const GAMES_FILE =
    path.join(DATA_DIR, 'games.json');

const FINISHED_GAME_RETENTION_MS =
    24 * 60 * 60 * 1000;

const CLEANUP_INTERVAL_MS =
    60 * 60 * 1000;

const WEB_PUBLIC_URL =
    process.env.WEB_PUBLIC_URL ||
    `http://localhost:${PORT}`;


app.use(cors());
app.use(express.json());
app.use(express.static('public'));


// ============================================================
// データ
// ============================================================

function ensureDataDirectory() {

    if (!fs.existsSync(DATA_DIR)) {

        fs.mkdirSync(
            DATA_DIR,
            {
                recursive: true
            }
        );

    }

}


function saveGames() {

    ensureDataDirectory();

    const tempFile =
        `${GAMES_FILE}.tmp`;

    fs.writeFileSync(
        tempFile,
        JSON.stringify(
            games,
            null,
            2
        ),
        'utf8'
    );

    fs.renameSync(
        tempFile,
        GAMES_FILE
    );

}


function loadGames() {

    ensureDataDirectory();

    if (!fs.existsSync(GAMES_FILE)) {

        return {};

    }

    try {

        const raw =
            fs.readFileSync(
                GAMES_FILE,
                'utf8'
            );

        if (!raw.trim()) {

            return {};

        }

        const loaded =
            JSON.parse(raw);

        if (
            !loaded ||
            typeof loaded !== 'object'
        ) {

            return {};

        }

        return loaded;

    } catch (error) {

        console.error(
            'ゲームデータの読み込みに失敗しました:',
            error
        );

        return {};

    }

}


const games =
    loadGames();


// ============================================================
// 共通
// ============================================================

function createGameId() {

    return crypto
        .randomBytes(8)
        .toString('hex');

}


function createToken() {

    return crypto
        .randomBytes(24)
        .toString('hex');

}


function getChessState(game) {

    return {

        lastMove:
            game.lastMove,

        castlingRights:
            game.castlingRights

    };

}


function getGameStatus(game) {

    return chess.getGameStatus(

        game.board,

        game.turn,

        getChessState(game)

    );

}


function getGameUrl(
    gameId,
    token = null
) {

    let url =
        `${WEB_PUBLIC_URL}/?game=` +
        encodeURIComponent(gameId);

    if (token) {

        url +=
            `&token=${encodeURIComponent(token)}`;

    }

    return url;

}


function getActiveGameCount() {

    return Object.values(games)
        .filter(
            game =>
                game.status === 'playing'
        )
        .length;

}


// ============================================================
// 認証
// ============================================================

function getPlayerColor(
    game,
    token
) {

    if (!token) {

        return null;

    }

    if (
        token ===
        game.players.white.token
    ) {

        return chess.WHITE;

    }

    if (
        token ===
        game.players.black.token
    ) {

        return chess.BLACK;

    }

    return null;

}


function requirePlayer(
    game,
    token
) {

    const color =
        getPlayerColor(
            game,
            token
        );

    if (!color) {

        return {

            ok: false,

            response: {

                success: false,

                message:
                    '対局者用URLが必要です。'

            }

        };

    }

    return {

        ok: true,

        color

    };

}


// ============================================================
// 公開用ゲーム情報
// ============================================================

function publicGame(
    game,
    token = null
) {

    const playerColor =
        getPlayerColor(
            game,
            token
        );

    const chessStatus =
        getGameStatus(game);

    return {

        id:
            game.id,

        board:
            game.board,

        turn:
            game.turn,

        lastMove:
            game.lastMove,

        castlingRights:
            game.castlingRights,

        pendingPromotion:
            game.pendingPromotion,

        status:
            game.status,

        chessStatus,

        createdAt:
            game.createdAt,

        updatedAt:
            game.updatedAt,

        finishedAt:
            game.finishedAt ||
            null,

        white: {

            userId:
                game.players.white.userId,

            name:
                game.players.white.name

        },

        black: {

            userId:
                game.players.black.userId,

            name:
                game.players.black.name

        },

        discord: {

            channelId:
                game.discord?.channelId ||
                null,

            messageId:
                game.discord?.messageId ||
                null

        },

        playerColor,

        canControl:
            Boolean(
                playerColor &&
                game.status === 'playing' &&
                game.turn === playerColor
            )

    };

}


// ============================================================
// 終了対局の整理
// ============================================================

function cleanupFinishedGames() {

    const now =
        Date.now();

    let removed =
        0;

    for (
        const [gameId, game]
            of Object.entries(games)
    ) {

        if (
            game.status !==
            'finished'
        ) {

            continue;

        }

        if (!game.finishedAt) {

            continue;

        }

        const finishedAt =
            new Date(
                game.finishedAt
            ).getTime();

        if (
            !Number.isFinite(
                finishedAt
            )
        ) {

            continue;

        }

        if (
            now -
            finishedAt >=
            FINISHED_GAME_RETENTION_MS
        ) {

            delete games[gameId];

            removed++;

        }

    }

    if (removed > 0) {

        saveGames();

        console.log(
            `終了済みゲーム ${removed} 件を整理しました。`
        );

    }

}


setInterval(
    cleanupFinishedGames,
    CLEANUP_INTERVAL_MS
);

cleanupFinishedGames();


// ============================================================
// APIテスト
// ============================================================

app.get(
    '/api/test',
    (req, res) => {

        res.json({

            success:
                true,

            message:
                'Discord Chess Server is connected',

            games:
                Object.keys(games).length,

            activeGames:
                getActiveGameCount(),

            maxActiveGames:
                MAX_ACTIVE_GAMES

        });

    }
);


// ============================================================
// ゲーム一覧
// ============================================================

app.get(
    '/api/games',
    (req, res) => {

        const activeOnly =
            req.query.active === '1';

        const result =
            Object.values(games)

                .filter(
                    game => {

                        if (!activeOnly) {

                            return true;

                        }

                        return (
                            game.status ===
                            'playing'
                        );

                    }
                )

                .map(
                    game =>
                        publicGame(game)
                );

        res.json({

            success:
                true,

            games:
                result,

            activeGames:
                getActiveGameCount(),

            maxActiveGames:
                MAX_ACTIVE_GAMES

        });

    }
);


// ============================================================
// ゲーム作成
// ============================================================

app.post(
    '/api/games',
    (req, res) => {

        try {

            cleanupFinishedGames();

            const activeGames =
                getActiveGameCount();

            if (
                activeGames >=
                MAX_ACTIVE_GAMES
            ) {

                return res.status(409).json({

                    success:
                        false,

                    code:
                        'MAX_ACTIVE_GAMES',

                    message:
                        `現在進行中の対局が` +
                        `${MAX_ACTIVE_GAMES}局に達しています。` +
                        `新しい対局を開始するには、` +
                        `現在の対局を終了してください。`,

                    activeGames,

                    maxActiveGames:
                        MAX_ACTIVE_GAMES

                });

            }


            const {

                whiteUserId,

                blackUserId,

                whiteName =
                    '白',

                blackName =
                    '黒'

            } = req.body;


            if (
                !whiteUserId ||
                !blackUserId
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        'whiteUserId and blackUserId are required'

                });

            }


            if (
                String(whiteUserId) ===
                String(blackUserId)
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        '同じユーザー同士では対局できません。'

                });

            }


            const state =
                chess.createGameState();

            const gameId =
                createGameId();

            const now =
                new Date().toISOString();


            const game = {

                id:
                    gameId,

                board:
                    state.board,

                turn:
                    state.turn,

                lastMove:
                    state.lastMove,

                castlingRights:
                    state.castlingRights,

                pendingPromotion:
                    state.pendingPromotion,

                status:
                    'playing',

                createdAt:
                    now,

                updatedAt:
                    now,

                finishedAt:
                    null,

                result:
                    null,

                players: {

                    white: {

                        userId:
                            String(whiteUserId),

                        name:
                            String(whiteName),

                        token:
                            createToken()

                    },

                    black: {

                        userId:
                            String(blackUserId),

                        name:
                            String(blackName),

                        token:
                            createToken()

                    }

                },

                discord: {

                    channelId:
                        null,

                    messageId:
                        null

                }

            };


            games[gameId] =
                game;


            saveGames();


            res.status(201).json({

                success:
                    true,

                gameId,

                game:
                    publicGame(game),

                activeGames:
                    getActiveGameCount(),

                maxActiveGames:
                    MAX_ACTIVE_GAMES,

                playerUrls: {

                    white:
                        getGameUrl(
                            gameId,
                            game.players.white.token
                        ),

                    black:
                        getGameUrl(
                            gameId,
                            game.players.black.token
                        )

                },

                observerUrl:
                    getGameUrl(
                        gameId
                    )

            });


        } catch (error) {

            console.error(
                'Game creation error:',
                error
            );

            res.status(500).json({

                success:
                    false,

                message:
                    'ゲームの作成に失敗しました。'

            });

        }

    }
);


// ============================================================
// ゲーム取得
// ============================================================

app.get(
    '/api/game/:gameId',
    (req, res) => {

        const game =
            games[
                req.params.gameId
            ];

        if (!game) {

            return res.status(404).json({

                success:
                    false,

                message:
                    'ゲームが見つかりません。'

            });

        }

        const token =
            typeof req.query.token ===
            'string'
                ? req.query.token
                : null;

        res.json({

            success:
                true,

            game:
                publicGame(
                    game,
                    token
                )

        });

    }
);


// ============================================================
// Discordメッセージ登録
// ============================================================

app.post(
    '/api/game/:gameId/discord-message',
    (req, res) => {

        const game =
            games[
                req.params.gameId
            ];

        if (!game) {

            return res.status(404).json({

                success:
                    false,

                message:
                    'ゲームが見つかりません。'

            });

        }

        const {

            channelId,

            messageId

        } = req.body;

        if (
            !channelId ||
            !messageId
        ) {

            return res.status(400).json({

                success:
                    false,

                message:
                    'channelId and messageId are required'

            });

        }

        game.discord = {

            channelId:
                String(channelId),

            messageId:
                String(messageId)

        };

        game.updatedAt =
            new Date().toISOString();

        saveGames();

        res.json({

            success:
                true,

            game:
                publicGame(game)

        });

    }
);


// ============================================================
// 合法手
// ============================================================

app.post(
    '/api/game/:gameId/legal-moves',
    (req, res) => {

        try {

            const game =
                games[
                    req.params.gameId
                ];

            if (!game) {

                return res.status(404).json({

                    success:
                        false,

                    message:
                        'ゲームが見つかりません。'

                });

            }

            const {
                square
            } = req.body;

            if (!square) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        'square is required'

                });

            }

            const token =
                typeof req.query.token ===
                'string'
                    ? req.query.token
                    : req.body.token;

            const auth =
                requirePlayer(
                    game,
                    token
                );

            if (!auth.ok) {

                return res.status(403).json(
                    auth.response
                );

            }

            if (
                game.status !==
                'playing'
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        'このゲームは終了しています。'

                });

            }

            if (
                game.turn !==
                auth.color
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        '現在の手番ではありません。'

                });

            }

            const moves =
                chess.getLegalMoves(

                    game.board,

                    square,

                    game.turn,

                    getChessState(game)

                );

            res.json({

                success:
                    true,

                moves

            });

        } catch (error) {

            console.error(
                'Legal moves error:',
                error
            );

            res.status(500).json({

                success:
                    false,

                message:
                    '合法手の取得に失敗しました。'

            });

        }

    }
);


// ============================================================
// 移動
// ============================================================

app.post(
    '/api/game/:gameId/move',
    (req, res) => {

        try {

            const game =
                games[
                    req.params.gameId
                ];

            if (!game) {

                return res.status(404).json({

                    success:
                        false,

                    message:
                        'ゲームが見つかりません。'

                });

            }

            const {

                from,

                to,

                token

            } = req.body;

            if (
                !from ||
                !to ||
                !token
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        'from, to, token are required'

                });

            }

            const auth =
                requirePlayer(
                    game,
                    token
                );

            if (!auth.ok) {

                return res.status(403).json(
                    auth.response
                );

            }

            if (
                game.status !==
                'playing'
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        'このゲームは終了しています。'

                });

            }

            if (
                game.turn !==
                auth.color
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        '現在の手番ではありません。'

                });

            }

            const currentStatus =
                getGameStatus(game);

            if (
                currentStatus ===
                'checkmate' ||
                currentStatus ===
                'stalemate'
            ) {

                game.status =
                    'finished';

                game.finishedAt =
                    game.finishedAt ||
                    new Date().toISOString();

                saveGames();

                return res.status(400).json({

                    success:
                        false,

                    message:
                        'このゲームは終了しています。'

                });

            }

            const legalMoves =
                chess.getLegalMoves(

                    game.board,

                    from,

                    game.turn,

                    getChessState(game)

                );

            const selectedMove =
                legalMoves.find(
                    move =>
                        move.to ===
                        to
                );

            if (!selectedMove) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        'Illegal move'

                });

            }

            const movingColor =
                game.turn;

            const result =
                chess.makeGameMove(

                    game,

                    selectedMove

                );

            game.updatedAt =
                new Date().toISOString();

            if (
                result &&
                result.promotion
            ) {

                saveGames();

                return res.json({

                    success:
                        true,

                    promotion:
                        true,

                    game:
                        publicGame(
                            game,
                            token
                        )

                });

            }

            game.turn =
                chess.opponent(
                    movingColor
                );

            const status =
                getGameStatus(game);

            if (
                status ===
                'checkmate' ||
                status ===
                'stalemate'
            ) {

                game.status =
                    'finished';

                game.finishedAt =
                    new Date().toISOString();

            }

            saveGames();

            res.json({

                success:
                    true,

                result,

                status,

                game:
                    publicGame(
                        game,
                        token
                    )

            });

        } catch (error) {

            console.error(
                'Move error:',
                error
            );

            res.status(500).json({

                success:
                    false,

                message:
                    '指し手の処理に失敗しました。'

            });

        }

    }
);


// ============================================================
// 昇格
// ============================================================

app.post(
    '/api/game/:gameId/promote',
    (req, res) => {

        try {

            const game =
                games[
                    req.params.gameId
                ];

            if (!game) {

                return res.status(404).json({

                    success:
                        false,

                    message:
                        'ゲームが見つかりません。'

                });

            }

            const {

                type,

                token

            } = req.body;

            if (
                !type ||
                !token
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        'type and token are required'

                });

            }

            const auth =
                requirePlayer(
                    game,
                    token
                );

            if (!auth.ok) {

                return res.status(403).json(
                    auth.response
                );

            }

            if (
                game.status !==
                'playing'
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        'このゲームは終了しています。'

                });

            }

            if (
                game.turn !==
                auth.color
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        '現在の手番ではありません。'

                });

            }

            if (!game.pendingPromotion) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        '昇格待ちではありません。'

                });

            }

            const promotionColor =
                game.turn;

            const result =
                chess.promotePawn(

                    game,

                    game.pendingPromotion,

                    type

                );

            if (!result) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        '無効な昇格です。'

                });

            }

            game.turn =
                chess.opponent(
                    promotionColor
                );

            game.updatedAt =
                new Date().toISOString();

            const status =
                getGameStatus(game);

            if (
                status ===
                'checkmate' ||
                status ===
                'stalemate'
            ) {

                game.status =
                    'finished';

                game.finishedAt =
                    new Date().toISOString();

            }

            saveGames();

            res.json({

                success:
                    true,

                status,

                game:
                    publicGame(
                        game,
                        token
                    )

            });

        } catch (error) {

            console.error(
                'Promotion error:',
                error
            );

            res.status(500).json({

                success:
                    false,

                message:
                    '昇格処理に失敗しました。'

            });

        }

    }
);


// ============================================================
// 投了
// ============================================================

app.post(
    '/api/game/:gameId/resign',
    (req, res) => {

        try {

            const game =
                games[
                    req.params.gameId
                ];

            if (!game) {

                return res.status(404).json({

                    success:
                        false,

                    message:
                        'ゲームが見つかりません。'

                });

            }

            const {
                token
            } = req.body;

            const auth =
                requirePlayer(
                    game,
                    token
                );

            if (!auth.ok) {

                return res.status(403).json(
                    auth.response
                );

            }

            if (
                game.status !==
                'playing'
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        'このゲームは終了しています。'

                });

            }

            if (
                game.turn !==
                auth.color
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        '現在の手番ではありません。'

                });

            }

            const loser =
                game.turn;

            const winner =
                chess.opponent(
                    loser
                );

            game.status =
                'finished';

            game.finishedAt =
                new Date().toISOString();

            game.updatedAt =
                new Date().toISOString();

            game.result = {

                type:
                    'resignation',

                loser,

                winner

            };

            saveGames();

            res.json({

                success:
                    true,

                result:
                    game.result,

                game:
                    publicGame(
                        game,
                        token
                    )

            });

        } catch (error) {

            console.error(
                'Resign error:',
                error
            );

            res.status(500).json({

                success:
                    false,

                message:
                    '投了処理に失敗しました。'

            });

        }

    }
);


// ============================================================
// リセット
// ============================================================

app.post(
    '/api/game/:gameId/reset',
    (req, res) => {

        try {

            const game =
                games[
                    req.params.gameId
                ];

            if (!game) {

                return res.status(404).json({

                    success:
                        false,

                    message:
                        'ゲームが見つかりません。'

                });

            }

            const {
                token
            } = req.body;

            const auth =
                requirePlayer(
                    game,
                    token
                );

            if (!auth.ok) {

                return res.status(403).json(
                    auth.response
                );

            }

            const state =
                chess.createGameState();

            game.board =
                state.board;

            game.turn =
                state.turn;

            game.lastMove =
                state.lastMove;

            game.castlingRights =
                state.castlingRights;

            game.pendingPromotion =
                state.pendingPromotion;

            game.status =
                'playing';

            game.finishedAt =
                null;

            game.result =
                null;

            game.updatedAt =
                new Date().toISOString();

            saveGames();

            res.json({

                success:
                    true,

                game:
                    publicGame(
                        game,
                        token
                    )

            });

        } catch (error) {

            console.error(
                'Reset error:',
                error
            );

            res.status(500).json({

                success:
                    false,

                message:
                    'リセットに失敗しました。'

            });

        }

    }
);


// ============================================================
// 404
// ============================================================

app.use(
    (req, res) => {

        if (
            req.path.startsWith('/api/')
        ) {

            return res.status(404).json({

                success:
                    false,

                message:
                    'API endpoint not found'

            });

        }

        res.status(404).send(
            'Not Found'
        );

    }
);


// ============================================================
// サーバー起動
// ============================================================

app.listen(
    PORT,
    () => {

        ensureDataDirectory();

        console.log(
            '================================='
        );

        console.log(
            'Discord Chess Game Server started'
        );

        console.log(
            `Web UI: ${WEB_PUBLIC_URL}`
        );

        console.log(
            `API: http://localhost:${PORT}/api/test`
        );

        console.log(
            `Games: http://localhost:${PORT}/api/games`
        );

        console.log(
            `最大同時対局数: ${MAX_ACTIVE_GAMES}`
        );

        console.log(
            `保存先: ${GAMES_FILE}`
        );

        console.log(
            `登録ゲーム数: ${
                Object.keys(games).length
            }`
        );

        console.log(
            `進行中ゲーム数: ${
                getActiveGameCount()
            }`
        );

        console.log(
            '終了対局の保存期間: 24時間'
        );

        console.log(
            '================================='
        );

    }
);