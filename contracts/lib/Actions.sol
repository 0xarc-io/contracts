pragma solidity ^0.6.6;


library Actions {
    enum ActionType {
        ProvideLiquidity,
        WithdrawLiquidity,
        OpenPosition,
        BorrowPosition,
        RepayPosition,
        ClosePosition,
        LiquidatePosition
    }

    struct ActionArg {
        ActionType action;
    }
}
