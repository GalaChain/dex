TL;DR GDEX has a fundamental problem where inactive liquidity positions are being drained by swap operations. See the claude report file below for detailed analysis.

===

I've been doing some liquidity bot testing this weekend and think I've found a bug. I added 100 USDT to GALA/USDT below the current trading range. The UI rightfully told me that the position wouldn't be used in trades until the market price moves into range. I completed the deposit and the position immediately got drained by a flurry of BOT activity (link: https://gala-rdr1717.slack.com/archives/C09CQ554TTL/p1761500251438849). The pool price wasn't in range at any time that I can see.

Additionally, the position UI on swap.gala.com is showing 0 for both tokens, although the JSON from the backend seems to have more useful info:

```
{
    "Status": 1,
    "Data": {
        "fee": 10000,
        "feeGrowthInside0Last": "0",
        "feeGrowthInside1Last": "0",
        "liquidity": "3416.619557680575700653",
        "poolHash": "cc93185e6902353cc0e912099790826089d3e3cba8e1e5aa3d5eba9d0c31d742",
        "positionId": "c1bbd2fa88f135347a7bc719323ba5174e4a24064be944482a01f815dcc45d34",
        "tickLower": -47200,
        "tickUpper": -41800,
        "token0ClassKey": {
            "additionalKey": "none",
            "category": "Unit",
            "collection": "GALA",
            "type": "none"
        },
        "token1ClassKey": {
            "additionalKey": "none",
            "category": "Unit",
            "collection": "GUSDT",
            "type": "none"
        },
        "tokensOwed0": "0",
        "tokensOwed1": "0"
    }
}
```

When I try to remove the liquidity from the position, I get the finger because the position has been completely drained.

Screenshot of adding liquidity outside of the range:

<img width="1129" height="1262" alt="image" src="https://gist.github.com/user-attachments/assets/ced2a667-b52c-40bb-bf25-b9198bc3f532" />

Screenshot of the position after the bots drained it:

<img width="1199" height="828" alt="image" src="https://gist.github.com/user-attachments/assets/ef0cc654-216e-4b4d-9e87-ce44610050a4" />

Screenshot giving me the middle finger on withdrawal attempt:

<img width="652" height="484" alt="image" src="https://gist.github.com/user-attachments/assets/5cf94e82-9026-4523-9b8e-538f44a818b8" />