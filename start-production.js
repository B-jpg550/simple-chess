require('dotenv').config();

const { spawn } = require('child_process');

const port =
    Number(process.env.PORT) || 3000;

const localServerUrl =
    `http://127.0.0.1:${port}`;

process.env.PORT =
    String(port);

process.env.CHESS_SERVER_URL =
    process.env.CHESS_SERVER_URL ||
    localServerUrl;

console.log('=================================');
console.log('Discord Chess Production Launcher');
console.log(`PORT: ${process.env.PORT}`);
console.log(`CHESS_SERVER_URL: ${process.env.CHESS_SERVER_URL}`);
console.log(
    `WEB_PUBLIC_URL: ${
        process.env.WEB_PUBLIC_URL || '(not set)'
    }`
);
console.log('=================================');


const processes = [];


function startProcess(
    name,
    file
) {

    const child =
        spawn(
            process.execPath,
            [file],
            {
                stdio: 'inherit',
                env: process.env
            }
        );

    processes.push({
        name,
        child
    });


    child.on(
        'exit',
        (code, signal) => {

            console.error(
                `${name} exited. code=${code}, signal=${signal}`
            );

            if (
                code !== 0 &&
                signal === null
            ) {

                shutdown(1);

            }

        }
    );


    child.on(
        'error',
        error => {

            console.error(
                `${name} startup error:`,
                error
            );

            shutdown(1);

        }
    );

}


function shutdown(
    code = 0
) {

    for (
        const item
            of processes
    ) {

        if (
            !item.child.killed
        ) {

            item.child.kill(
                'SIGTERM'
            );

        }

    }


    setTimeout(
        () => {

            process.exit(code);

        },
        1000
    );

}


process.on(
    'SIGINT',
    () => {

        console.log(
            'SIGINT received. Shutting down...'
        );

        shutdown();

    }
);


process.on(
    'SIGTERM',
    () => {

        console.log(
            'SIGTERM received. Shutting down...'
        );

        shutdown();

    }
);


startProcess(
    'Web Server',
    'server.js'
);


startProcess(
    'Discord Bot',
    'index-discord.js'
);