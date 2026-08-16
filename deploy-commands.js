require('dotenv').config();

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');

const commands = [

    new SlashCommandBuilder()
        .setName('chess')
        .setDescription('Discord Chessを操作します。')

        // ====================================================
        // 対局開始
        // ====================================================

        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Webでチェス対局を開始します。')

                .addUserOption(option =>
                    option
                        .setName('opponent')
                        .setDescription('対戦相手')
                        .setRequired(true)
                )
        )

        // ====================================================
        // 対局一覧
        // ====================================================

        .addSubcommand(subcommand =>
            subcommand
                .setName('games')
                .setDescription('現在進行中の対局を確認します。')
        )

].map(command => command.toJSON());


const rest =
    new REST({
        version: '10'
    }).setToken(
        process.env.DISCORD_TOKEN
    );


// ============================================================
// Slash Command登録
// ============================================================

(async () => {

    try {

        console.log(
            'Slash Commandを登録しています...'
        );

        await rest.put(

            Routes.applicationGuildCommands(

                process.env.CLIENT_ID,

                process.env.GUILD_ID

            ),

            {
                body: commands
            }

        );

        console.log(
            'Slash Commandの登録が完了しました！'
        );

    } catch (error) {

        console.error(
            'Slash Command登録エラー:',
            error
        );

        process.exitCode = 1;

    }

})();