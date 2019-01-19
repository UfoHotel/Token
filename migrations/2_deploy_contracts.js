const Token = artifacts.require('./UHCToken.sol')
const Receiver = artifacts.require('./EtherReceiver.sol')

function time() {
    return parseInt(new Date().getTime() / 1000)
}

module.exports = deployer => {
    deployer.deploy(Token, 'UHC-Token', 'UHC', 2, 1000000, 3, 1).then(() => {
        deployer.link(Token, Receiver)
        deployer.deploy(
            Receiver,
            Token.address,
            time(),
            1000000000,
            10000000000,
            3 * 30 * 24 * 60 * 60,
            [24999, 99999, 349999, 1299999],
            5,
            true,
        )
    })
}
