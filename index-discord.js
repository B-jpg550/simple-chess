require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

const SERVER_URL =
    process.env.CHESS_SERVER_URL ||
    'http://localhost:3000';

const monitoredMessages = new Map();


// ============================================================
// API
// ============================================================

async function getGames() {

    const response =
        await fetch(
            `${SERVER_URL}/api/games`
        );

    if (!response.ok) {

        throw new Error(
            `Server API error: ${response.status}`
        );

    }

    const data =
        await response.json();

    if (!data.success) {

        throw new Error(
            data.message ||
            'Game API failed'
        );

    }

    return data.games || [];

}


async function createGame(
    whiteUserId,
    blackUserId,
    whiteName,
    blackName
) {

    const response =
        await fetch(
            `${SERVER_URL}/api/games`,
            {

                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify({

                    whiteUserId:
                        String(whiteUserId),

                    blackUserId:
                        String(blackUserId),

                    whiteName:
                        whiteName,

                    blackName:
                        blackName

                })

            }
        );

    const data =
        await response.json();

    if (!response.ok) {

        throw new Error(
            data.message ||
            'Game creation failed'
        );

    }

    return data;

}


async function registerDiscordMessage(
    gameId,
    channelId,
    messageId
) {

    const response =
        await fetch(

            `${SERVER_URL}/api/game/` +
            `${encodeURIComponent(gameId)}` +
            `/discord-message`,

            {

                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify({

                    channelId:
                        String(channelId),

                    messageId:
                        String(messageId)

                })

            }

        );

    const data =
        await response
            .json()
            .catch(() => ({}));

    if (!response.ok) {

        throw new Error(
            data.message ||
            'Discord message registration failed'
        );

    }

    return data;

}


// ============================================================
// 表示
// ============================================================

function turnText(turn) {

    return turn === 'white'
        ? '⚪ 白の手番'
        : '⚫ 黒の手番';

}


function getPlayerName(
    player
) {

    return (
        player &&
        player.name
    )
        ? player.name
        : '不明';

}


function getStatus(
    game
) {

    if (
        game.status ===
        'finished'
    ) {

        if (
            game.result &&
            game.result.type ===
            'resignation'
        ) {

            const winner =
                game.result.winner ===
                'white'
                    ? '⚪ 白'
                    : '⚫ 黒';

            return (
                `🏳️ 投了\n` +
                `🏆 ${winner}の勝利`
            );

        }

        if (
            game.chessStatus ===
            'checkmate'
        ) {

            const winner =
                game.turn ===
                'white'
                    ? '⚫ 黒'
                    : '⚪ 白';

            return (
                `💥 チェックメイト\n` +
                `🏆 ${winner}の勝利`
            );

        }

        if (
            game.chessStatus ===
            'stalemate'
        ) {

            return (
                '🤝 ステイルメイト\n' +
                '引き分け'
            );

        }

        return '🏁 対局終了';

    }


    if (
        game.chessStatus ===
        'check'
    ) {

        return '⚠️ チェック';

    }


    return '🎮 対局中';

}


function boardToString(
    board
) {

    let text =
        '```text\n';

    text +=
        '    A B C D E F G H\n';

    for (
        let row = 0;
        row < 8;
        row++
    ) {

        text +=
            `${8 - row}  `;

        for (
            let col = 0;
            col < 8;
            col++
        ) {

            text +=
                `${board[row][col]} `;

        }

        text +=
            ` ${8 - row}\n`;

    }

    text +=
        '    A B C D E F G H\n';

    text +=
        '```';

    return text;

}


function getObserverUrl(
    gameId
) {

    return (
        `${SERVER_URL}/?game=` +
        encodeURIComponent(gameId)
    );

}


function getLastMoveText(
    game
) {

    if (!game.lastMove) {

        return 'まだ指し手はありません';

    }

    const last =
        game.lastMove;

    let text =
        `${last.from} → ${last.to}`;

    if (
        last.type ===
        'castleKingSide'
    ) {

        text +=
            '（キングサイド・キャスリング）';

    }

    if (
        last.type ===
        'castleQueenSide'
    ) {

        text +=
            '（クイーンサイド・キャスリング）';

    }

    if (
        last.type ===
        'enPassant'
    ) {

        text +=
            '（アンパッサン）';

    }

    return text;

}


function buildEmbed(
    game
) {

    const status =
        getStatus(game);

    const turn =
        turnText(
            game.turn
        );

    const embed =
        new EmbedBuilder()
            .setTitle(
                '♟️ Discord Chess'
            )
            .setDescription(
                'サーバー上のWeb対局を監視しています。'
            )
            .addFields(

                {
                    name:
                        '⚪ 白',

                    value:
                        getPlayerName(
                            game.white
                        ),

                    inline: true
                },

                {
                    name:
                        '⚫ 黒',

                    value:
                        getPlayerName(
                            game.black
                        ),

                    inline: true
                },

                {
                    name:
                        '現在の状態',

                    value:
                        status,

                    inline: false
                },

                {
                    name:
                        '手番',

                    value:
                        turn,

                    inline: true
                },

                {
                    name:
                        '最後の手',

                    value:
                        getLastMoveText(
                            game
                        ),

                    inline: true
                },

                {
                    name:
                        '対局ID',

                    value:
                        `\`${game.id}\``,

                    inline: false
                },

                {
                    name:
                        '観戦URL',

                    value:
                        getObserverUrl(
                            game.id
                        ),

                    inline: false
                }

            )
            .setTimestamp(
                new Date(
                    game.updatedAt ||
                    Date.now()
                )
            );

    return embed;

}


function buildMessage(
    game
) {

    const text =
        boardToString(
            game.board
        );

    return {

        content:
            text,

        embeds: [
            buildEmbed(
                game
            )
        ]

    };

}


// ============================================================
// Discord監視更新
// ============================================================

async function updateMonitoredMessage(
    game
) {

    if (
        !game.discord ||
        !game.discord.channelId ||
        !game.discord.messageId
    ) {

        return;

    }

    const cacheKey =
        `${game.discord.channelId}:` +
        `${game.discord.messageId}`;

    const previous =
        monitoredMessages.get(
            cacheKey
        );

    const signature =
        JSON.stringify({

            updatedAt:
                game.updatedAt,

            status:
                game.status,

            turn:
                game.turn,

            board:
                game.board,

            lastMove:
                game.lastMove

        });

    if (
        previous ===
        signature
    ) {

        return;

    }

    try {

        const channel =
            await client.channels.fetch(
                game.discord.channelId
            );

        if (!channel) {
            return;
        }

        const message =
            await channel.messages.fetch(
                game.discord.messageId
            );

        await message.edit(
            buildMessage(game)
        );

        monitoredMessages.set(
            cacheKey,
            signature
        );

    } catch (error) {

        console.error(
            `監視更新失敗 ` +
            `${game.id}:`,
            error.message
        );

    }

}


// ============================================================
// 全対局監視
// ============================================================

async function refreshGames() {

    try {

        const games =
            await getGames();

        for (
            const game of games
        ) {

            await updateMonitoredMessage(
                game
            );

        }

    } catch (error) {

        console.error(
            'Game monitor error:',
            error.message
        );

    }

}


// ============================================================
// 起動
// ============================================================

client.once(
    'ready',
    async () => {

        console.log(
            `${client.user.tag}としてログインしました！`
        );

        console.log(
            `Web Server: ${SERVER_URL}`
        );

        console.log(
            'Discord監視モードで起動しました。'
        );

        await refreshGames();

        setInterval(
            refreshGames,
            2000
        );

    }
);


// ============================================================
// Slash Commands
// ============================================================

client.on(
    'interactionCreate',
    async interaction => {

        if (
            !interaction.isChatInputCommand()
        ) {

            return;

        }

        if (
            interaction.commandName !==
            'chess'
        ) {

            return;

        }

        const subcommand =
            interaction.options
                .getSubcommand();


        // ====================================================
        // /chess start
        // ====================================================

        if (
            subcommand ===
            'start'
        ) {

            const opponent =
                interaction.options
                    .getUser(
                        'opponent'
                    );

            if (!opponent) {

                await interaction.reply({

                    content:
                        '❌ 対戦相手を指定してください。',

                    ephemeral:
                        true

                });

                return;

            }


            if (
                opponent.bot
            ) {

                await interaction.reply({

                    content:
                        '❌ Botとは対戦できません。',

                    ephemeral:
                        true

                });

                return;

            }


            if (
                opponent.id ===
                interaction.user.id
            ) {

                await interaction.reply({

                    content:
                        '❌ 自分自身とは対戦できません。',

                    ephemeral:
                        true

                });

                return;

            }


            try {

                const result =
                    await createGame(

                        interaction.user.id,

                        opponent.id,

                        interaction.user.username,

                        opponent.username

                    );


                const message =
                    await interaction.reply({

                        content:
                            boardToString(
                                result.game.board
                            ),

                        embeds: [
                            buildEmbed(
                                result.game
                            )
                        ],

                        fetchReply:
                            true

                    });


                await registerDiscordMessage(

                    result.gameId,

                    message.channel.id,

                    message.id

                );


                await interaction.followUp({

                    content:
                        '⚪ **あなたは白です。**\n\n' +
                        'Web対局URL:\n' +
                        `${result.playerUrls.white}`,

                    ephemeral:
                        true

                });


                try {

                    await opponent.send(

                        '♟️ **Discord Chess 対局開始**\n\n' +
                        `⚪ 白：${interaction.user.username}\n` +
                        `⚫ 黒：${opponent.username}\n\n` +
                        'あなたは黒です。\n\n' +
                        'Web対局URL:\n' +
                        `${result.playerUrls.black}`

                    );

                } catch (dmError) {

                    console.error(
                        '黒プレイヤーへのDM失敗:',
                        dmError.message
                    );

                }


            } catch (error) {

                console.error(
                    'Game creation error:',
                    error
                );

                if (
                    !interaction.replied &&
                    !interaction.deferred
                ) {

                    await interaction.reply({

                        content:
                            `❌ 対局作成に失敗しました。\n` +
                            `${error.message}`,

                        ephemeral:
                            true

                    });

                }

            }

            return;

        }


        // ====================================================
        // /chess games
        // ====================================================

        if (
            subcommand ===
            'games'
        ) {

            try {

                const games =
                    await getGames();

                const active =
                    games.filter(
                        game =>
                            game.status ===
                            'playing'
                    );


                if (
                    active.length ===
                    0
                ) {

                    await interaction.reply({

                        content:
                            '現在進行中の対局はありません。',

                        ephemeral:
                            true

                    });

                    return;

                }


                let text =
                    '♟️ **現在進行中の対局**\n\n';


                for (
                    const game of
                        active
                ) {

                    text +=
                        `**${getPlayerName(game.white)} ` +
                        `vs ${getPlayerName(game.black)}**\n`;

                    text +=
                        `${turnText(game.turn)}\n`;

                    text +=
                        `${getObserverUrl(game.id)}\n\n`;

                }


                await interaction.reply({

                    content:
                        text,

                    ephemeral:
                        true

                });

            } catch (error) {

                console.error(
                    'Games command error:',
                    error
                );

                await interaction.reply({

                    content:
                        '❌ 対局一覧を取得できませんでした。',

                    ephemeral:
                        true

                });

            }

        }

    }
);


// ============================================================
// ログイン
// ============================================================

client.login(
    process.env.DISCORD_TOKEN
);