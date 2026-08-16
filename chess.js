const EMPTY = '　';

const WHITE = 'white';
const BLACK = 'black';

const PIECE_TYPES = {
    '♙': 'pawn',
    '♟': 'pawn',
    '♖': 'rook',
    '♜': 'rook',
    '♘': 'knight',
    '♞': 'knight',
    '♗': 'bishop',
    '♝': 'bishop',
    '♕': 'queen',
    '♛': 'queen',
    '♔': 'king',
    '♚': 'king'
};

const WHITE_PIECES = ['♙','♖','♘','♗','♕','♔'];
const BLACK_PIECES = ['♟','♜','♞','♝','♛','♚'];

function createBoard() {
    return [
        ['♜','♞','♝','♛','♚','♝','♞','♜'],
        ['♟','♟','♟','♟','♟','♟','♟','♟'],
        [EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY],
        [EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY],
        [EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY],
        [EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY,EMPTY],
        ['♙','♙','♙','♙','♙','♙','♙','♙'],
        ['♖','♘','♗','♕','♔','♗','♘','♖']
    ];
}

function cloneBoard(board) {
    return board.map(row => [...row]);
}

function squareToPosition(square) {
    return {
        row: 8 - Number(square[1]),
        col: 'abcdefgh'.indexOf(square[0].toLowerCase())
    };
}

function positionToSquare(row, col) {
    return `${'abcdefgh'[col]}${8 - row}`;
}

function isInside(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function getColor(piece) {
    if (WHITE_PIECES.includes(piece)) return WHITE;
    if (BLACK_PIECES.includes(piece)) return BLACK;
    return null;
}

function opponent(color) {
    return color === WHITE ? BLACK : WHITE;
}

function getPieceType(piece) {
    return PIECE_TYPES[piece] || null;
}

function getAllPieces(board, color) {
    const pieces = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (getColor(board[row][col]) === color) {
                pieces.push({
                    square: positionToSquare(row, col),
                    piece: board[row][col]
                });
            }
        }
    }

    return pieces;
}

function findKing(board, color) {
    const king = color === WHITE ? '♔' : '♚';

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (board[row][col] === king) {
                return positionToSquare(row, col);
            }
        }
    }

    return null;
}


// ============================================================
// 通常の移動候補
// ============================================================

function getPseudoLegalMoves(board, square, color) {

    const { row, col } = squareToPosition(square);
    const piece = board[row][col];

    if (getColor(piece) !== color) {
        return [];
    }

    const type = getPieceType(piece);
    const moves = [];

    // -------------------------
    // ポーン
    // -------------------------

    if (type === 'pawn') {

        const direction = color === WHITE ? -1 : 1;
        const startRow = color === WHITE ? 6 : 1;

        const oneRow = row + direction;

        if (
            isInside(oneRow, col) &&
            board[oneRow][col] === EMPTY
        ) {

            moves.push({
                from: square,
                to: positionToSquare(oneRow, col),
                capture: false,
                type: 'normal'
            });

            const twoRow = row + direction * 2;

            if (
                row === startRow &&
                board[twoRow][col] === EMPTY
            ) {

                moves.push({
                    from: square,
                    to: positionToSquare(twoRow, col),
                    capture: false,
                    type: 'normal',
                    pawnDouble: true
                });
            }
        }

        for (const dc of [-1, 1]) {

            const r = row + direction;
            const c = col + dc;

            if (!isInside(r, c)) continue;

            if (
                getColor(board[r][c]) === opponent(color)
            ) {

                moves.push({
                    from: square,
                    to: positionToSquare(r, c),
                    capture: true,
                    type: 'normal'
                });
            }
        }

        return moves;
    }


    // -------------------------
    // ナイト
    // -------------------------

    if (type === 'knight') {

        const offsets = [
            [-2,-1],[-2,1],
            [-1,-2],[-1,2],
            [1,-2],[1,2],
            [2,-1],[2,1]
        ];

        for (const [dr, dc] of offsets) {

            const r = row + dr;
            const c = col + dc;

            if (!isInside(r,c)) continue;

            const target = board[r][c];

            if (
                target === EMPTY ||
                getColor(target) === opponent(color)
            ) {

                moves.push({
                    from: square,
                    to: positionToSquare(r,c),
                    capture: target !== EMPTY,
                    type: 'normal'
                });
            }
        }

        return moves;
    }


    // -------------------------
    // キング
    // -------------------------

    if (type === 'king') {

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {

                if (dr === 0 && dc === 0) continue;

                const r = row + dr;
                const c = col + dc;

                if (!isInside(r,c)) continue;

                const target = board[r][c];

                if (
                    target === EMPTY ||
                    getColor(target) === opponent(color)
                ) {

                    moves.push({
                        from: square,
                        to: positionToSquare(r,c),
                        capture: target !== EMPTY,
                        type: 'normal'
                    });
                }
            }
        }

        return moves;
    }


    // -------------------------
    // ルーク・ビショップ・クイーン
    // -------------------------

    let directions = [];

    if (type === 'rook') {
        directions = [
            [-1,0],[1,0],
            [0,-1],[0,1]
        ];
    }

    if (type === 'bishop') {
        directions = [
            [-1,-1],[-1,1],
            [1,-1],[1,1]
        ];
    }

    if (type === 'queen') {
        directions = [
            [-1,0],[1,0],
            [0,-1],[0,1],
            [-1,-1],[-1,1],
            [1,-1],[1,1]
        ];
    }

    for (const [dr,dc] of directions) {

        let r = row + dr;
        let c = col + dc;

        while (isInside(r,c)) {

            const target = board[r][c];

            if (target === EMPTY) {

                moves.push({
                    from: square,
                    to: positionToSquare(r,c),
                    capture: false,
                    type: 'normal'
                });

            } else {

                if (
                    getColor(target) === opponent(color)
                ) {

                    moves.push({
                        from: square,
                        to: positionToSquare(r,c),
                        capture: true,
                        type: 'normal'
                    });
                }

                break;
            }

            r += dr;
            c += dc;
        }
    }

    return moves;
}


// ============================================================
// 攻撃判定
// ============================================================

function getPawnAttacks(square, color) {

    const { row, col } = squareToPosition(square);
    const direction = color === WHITE ? -1 : 1;

    const result = [];

    for (const dc of [-1,1]) {

        const r = row + direction;
        const c = col + dc;

        if (isInside(r,c)) {
            result.push(positionToSquare(r,c));
        }
    }

    return result;
}

function isSquareAttacked(board, square, byColor) {

    const pieces = getAllPieces(board, byColor);

    for (const info of pieces) {

        const type = getPieceType(info.piece);

        if (type === 'pawn') {

            if (
                getPawnAttacks(
                    info.square,
                    byColor
                ).includes(square)
            ) {
                return true;
            }

        } else {

            const moves =
                getPseudoLegalMoves(
                    board,
                    info.square,
                    byColor
                );

            if (
                moves.some(
                    move => move.to === square
                )
            ) {
                return true;
            }
        }
    }

    return false;
}

function isInCheck(board, color) {

    const kingSquare = findKing(board, color);

    if (!kingSquare) return true;

    return isSquareAttacked(
        board,
        kingSquare,
        opponent(color)
    );
}


// ============================================================
// 仮想移動
// ============================================================

function applyMove(board, move) {

    const next = cloneBoard(board);

    const from = squareToPosition(move.from);
    const to = squareToPosition(move.to);

    next[to.row][to.col] =
        next[from.row][from.col];

    next[from.row][from.col] =
        EMPTY;

    // アンパッサン
    if (move.type === 'enPassant') {

        next[from.row][to.col] =
            EMPTY;
    }

    // キングサイドキャスリング
    if (move.type === 'castleKingSide') {

        next[from.row][5] =
            next[from.row][7];

        next[from.row][7] =
            EMPTY;
    }

    // クイーンサイドキャスリング
    if (move.type === 'castleQueenSide') {

        next[from.row][3] =
            next[from.row][0];

        next[from.row][0] =
            EMPTY;
    }

    return next;
}


// ============================================================
// アンパッサン
// ============================================================

function getEnPassantMoves(
    board,
    square,
    color,
    state
) {

    if (!state.lastMove) return [];

    if (
        !state.lastMove.pawnDouble
    ) {
        return [];
    }

    const { row, col } =
        squareToPosition(square);

    const piece =
        board[row][col];

    if (getPieceType(piece) !== 'pawn') {
        return [];
    }

    const last =
        squareToPosition(
            state.lastMove.to
        );

    if (
        last.row !== row ||
        Math.abs(last.col - col) !== 1
    ) {
        return [];
    }

    const direction =
        color === WHITE ? -1 : 1;

    const targetRow =
        row + direction;

    const targetSquare =
        positionToSquare(
            targetRow,
            last.col
        );

    return [{
        from: square,
        to: targetSquare,
        capture: true,
        type: 'enPassant'
    }];
}


// ============================================================
// キャスリング
// ============================================================

function getCastlingMoves(
    board,
    color,
    state
) {

    const result = [];

    const row =
        color === WHITE ? 7 : 0;

    const king =
        color === WHITE ? '♔' : '♚';

    const rook =
        color === WHITE ? '♖' : '♜';

    if (
        board[row][4] !== king
    ) {
        return result;
    }

    if (
        state.castlingRights[color].kingMoved
    ) {
        return result;
    }

    if (
        isInCheck(board,color)
    ) {
        return result;
    }

    // キングサイド
    if (
        !state.castlingRights[color].kingSideRookMoved &&
        board[row][5] === EMPTY &&
        board[row][6] === EMPTY &&
        board[row][7] === rook
    ) {

        if (
            !isSquareAttacked(
                board,
                positionToSquare(row,5),
                opponent(color)
            ) &&
            !isSquareAttacked(
                board,
                positionToSquare(row,6),
                opponent(color)
            )
        ) {

            result.push({
                from: positionToSquare(row,4),
                to: positionToSquare(row,6),
                capture: false,
                type: 'castleKingSide'
            });
        }
    }

    // クイーンサイド
    if (
        !state.castlingRights[color].queenSideRookMoved &&
        board[row][1] === EMPTY &&
        board[row][2] === EMPTY &&
        board[row][3] === EMPTY &&
        board[row][0] === rook
    ) {

        if (
            !isSquareAttacked(
                board,
                positionToSquare(row,3),
                opponent(color)
            ) &&
            !isSquareAttacked(
                board,
                positionToSquare(row,2),
                opponent(color)
            )
        ) {

            result.push({
                from: positionToSquare(row,4),
                to: positionToSquare(row,2),
                capture: false,
                type: 'castleQueenSide'
            });
        }
    }

    return result;
}


// ============================================================
// 合法手
// ============================================================

function getLegalMoves(
    board,
    square,
    color,
    state
) {

    const moves =
        getPseudoLegalMoves(
            board,
            square,
            color
        );

    const piece =
        board[
            squareToPosition(square).row
        ][
            squareToPosition(square).col
        ];

    if (
        getPieceType(piece) === 'pawn'
    ) {

        moves.push(
            ...getEnPassantMoves(
                board,
                square,
                color,
                state
            )
        );
    }

    if (
        getPieceType(piece) === 'king'
    ) {

        moves.push(
            ...getCastlingMoves(
                board,
                color,
                state
            )
        );
    }

    return moves.filter(move => {

        const next =
            applyMove(
                board,
                move
            );

        return !isInCheck(
            next,
            color
        );
    });
}


// ============================================================
// 全合法手
// ============================================================

function getAllLegalMoves(
    board,
    color,
    state
) {

    const result = [];

    for (
        const piece of getAllPieces(
            board,
            color
        )
    ) {

        for (
            const move of getLegalMoves(
                board,
                piece.square,
                color,
                state
            )
        ) {

            result.push(move);
        }
    }

    return result;
}


// ============================================================
// ゲーム状態
// ============================================================

function getGameStatus(
    board,
    color,
    state
) {

    const moves =
        getAllLegalMoves(
            board,
            color,
            state
        );

    const check =
        isInCheck(
            board,
            color
        );

    if (moves.length === 0) {

        if (check) {
            return 'checkmate';
        }

        return 'stalemate';
    }

    if (check) {
        return 'check';
    }

    return 'normal';
}


// ============================================================
// ゲーム状態作成
// ============================================================

function createGameState() {

    return {

        board: createBoard(),

        turn: WHITE,

        lastMove: null,

        castlingRights: {

            white: {
                kingMoved: false,
                kingSideRookMoved: false,
                queenSideRookMoved: false
            },

            black: {
                kingMoved: false,
                kingSideRookMoved: false,
                queenSideRookMoved: false
            }
        },

        pendingPromotion: null
    };
}


// ============================================================
// 移動実行
// ============================================================

function makeGameMove(
    state,
    move
) {

    const boardBefore =
        cloneBoard(state.board);

    const from =
        squareToPosition(move.from);

    const piece =
        boardBefore[from.row][from.col];

    const color =
        getColor(piece);

    // ルーク・キングの移動履歴
    if (
        getPieceType(piece) === 'king'
    ) {

        state.castlingRights[color].kingMoved = true;
    }

    if (
        getPieceType(piece) === 'rook'
    ) {

        if (color === WHITE) {

            if (move.from === 'a1') {
                state.castlingRights.white.queenSideRookMoved = true;
            }

            if (move.from === 'h1') {
                state.castlingRights.white.kingSideRookMoved = true;
            }

        } else {

            if (move.from === 'a8') {
                state.castlingRights.black.queenSideRookMoved = true;
            }

            if (move.from === 'h8') {
                state.castlingRights.black.kingSideRookMoved = true;
            }
        }
    }

    // ルークが取られた場合
    const to =
        squareToPosition(move.to);

    const captured =
        boardBefore[to.row][to.col];

    if (captured === '♖') {

        if (move.to === 'a1') {
            state.castlingRights.white.queenSideRookMoved = true;
        }

        if (move.to === 'h1') {
            state.castlingRights.white.kingSideRookMoved = true;
        }
    }

    if (captured === '♜') {

        if (move.to === 'a8') {
            state.castlingRights.black.queenSideRookMoved = true;
        }

        if (move.to === 'h8') {
            state.castlingRights.black.kingSideRookMoved = true;
        }
    }

    state.board =
        applyMove(
            state.board,
            move
        );

    state.lastMove = {
        from: move.from,
        to: move.to,
        type: move.type,
        pawnDouble: !!move.pawnDouble
    };

    // 昇格
    const destination =
        squareToPosition(move.to);

    const movedPiece =
        state.board[
            destination.row
        ][
            destination.col
        ];

    if (
        getPieceType(movedPiece) === 'pawn' &&
        (
            destination.row === 0 ||
            destination.row === 7
        )
    ) {

        state.pendingPromotion =
            move.to;

        return {
            promotion: true
        };
    }

    return {
        promotion: false
    };
}


// ============================================================
// 昇格
// ============================================================

function promotePawn(
    state,
    square,
    type
) {

    const { row, col } =
        squareToPosition(square);

    const pawn =
        state.board[row][col];

    const color =
        getColor(pawn);

    const pieces =
        color === WHITE
            ? {
                queen: '♕',
                rook: '♖',
                bishop: '♗',
                knight: '♘'
            }
            : {
                queen: '♛',
                rook: '♜',
                bishop: '♝',
                knight: '♞'
            };

    if (!pieces[type]) {
        return false;
    }

    state.board[row][col] =
        pieces[type];

    state.pendingPromotion =
        null;

    return true;
}


module.exports = {
    EMPTY,
    WHITE,
    BLACK,
    createBoard,
    createGameState,
    cloneBoard,
    squareToPosition,
    positionToSquare,
    getColor,
    opponent,
    getPieceType,
    getAllPieces,
    getLegalMoves,
    getAllLegalMoves,
    isInCheck,
    isSquareAttacked,
    getGameStatus,
    makeGameMove,
    promotePawn
};