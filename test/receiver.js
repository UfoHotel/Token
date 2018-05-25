const init = require('./init')
const utils = require('./utils')
const BigNumber = require('bignumber.js')

const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
const ethAddresses = []
const tokenSetting = init.tokenSetting
let tokenInstance
let receiverInstance
let fakeReceiverInstance
let fakeReceiverInstanceWithdraw

contract('Receiver', accounts => {
    it('(Init...) Token', async () => {
        ethAddresses.push(...(await init.initAccounts(accounts[0])))

        const tmp = []
        const ideal = [
            tokenSetting.totalSupply,
            tokenSetting.decimals,
            tokenSetting.name,
            tokenSetting.symbol,
            ethAddresses[0],
            tokenSetting.transferFeePercent,
        ]

        tokenInstance = await init.initToken(ethAddresses[0])

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.decimals()).valueOf())
        tmp.push((await tokenInstance.name()).valueOf())
        tmp.push((await tokenInstance.symbol()).valueOf())
        tmp.push((await tokenInstance.owner()).valueOf())
        tmp.push((await tokenInstance.transferFeePercent()).valueOf())

        await init.distributeTokens(tokenInstance, ethAddresses[0], ethAddresses)

        let result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('(Init...) Receivers', async () => {
        const tmp = []
        const ideal = []

        receiverInstance = await init.initReceiver(tokenInstance, ethAddresses[0])
        assert.ok(receiverInstance)
        fakeReceiverInstance = await init.initFinishedReceiver(tokenInstance, ethAddresses[0], false)
        assert.ok(fakeReceiverInstance)
        fakeReceiverInstanceWithdraw = await init.initFinishedReceiver(tokenInstance, ethAddresses[0], true)
        assert.ok(fakeReceiverInstanceWithdraw)

        tmp.push(
            (await tokenInstance.serviceGroupChange(receiverInstance.address, 3, { from: ethAddresses[0] }))['logs'][0][
                'args'
            ]['_newgroup'].valueOf(),
        )
        ideal.push(3)
        tmp.push((await receiverInstance.getGroup.call(ethAddresses[0])).valueOf())
        ideal.push(4)

        tmp.push(
            (await tokenInstance.serviceGroupChange(fakeReceiverInstance.address, 3, { from: ethAddresses[0] }))[
                'logs'
            ][0]['args']['_newgroup'].valueOf(),
        )
        ideal.push(3)
        tmp.push((await fakeReceiverInstance.getGroup.call(ethAddresses[0])).valueOf())
        ideal.push(4)

        tmp.push(
            (await tokenInstance.serviceGroupChange(fakeReceiverInstanceWithdraw.address, 3, {
                from: ethAddresses[0],
            }))['logs'][0]['args']['_newgroup'].valueOf(),
        )
        ideal.push(3)
        tmp.push((await fakeReceiverInstanceWithdraw.getGroup.call(ethAddresses[0])).valueOf())
        ideal.push(4)

        tmp.push(await init.distributeTokensToReceiver(tokenInstance, receiverInstance.address, ethAddresses[0]))
        ideal.push(init.receiverSetting.balance)

        let result = utils.validateValues(tmp, ideal)
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('Admin part... ', async () => {
        const tmp = []
        tmp.push(
            (await receiverInstance.serviceGroupChange(ethAddresses[1], 4, { from: ethAddresses[0] }))['logs'][0][
                'args'
            ]['_newgroup'].valueOf(),
        )

        tmp.push((await receiverInstance.getGroup.call(ethAddresses[1], { from: ethAddresses[0] })).valueOf())
        tmp.push(
            (await receiverInstance.serviceGroupChange(ethAddresses[1], 0, { from: ethAddresses[0] }))['logs'][0][
                'args'
            ]['_newgroup'].valueOf(),
        )
        tmp.push((await receiverInstance.getGroup.call(ethAddresses[1])).valueOf())
        await receiverInstance.setWeiPerMinToken(init.receiverSetting.weiPerMinToken * 2, { from: ethAddresses[0] })
        tmp.push(await receiverInstance.weiPerMinToken())

        const ideal = [4, 4, 0, 0, init.receiverSetting.weiPerMinToken * 2]
        const result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('Admin part.. [not-admin] ', async () => {
        const tmp = []

        await web3.personal.unlockAccount(ethAddresses[2], '')
        await receiverInstance.serviceGroupChange(ethAddresses[2], 4, { from: ethAddresses[2] }).catch(err => {
            tmp[0] = true
        })

        await web3.personal.unlockAccount(ethAddresses[1], '')
        await receiverInstance.transfer.call(ethAddresses[1], 100000, { from: ethAddresses[1] }).catch(err => {
            tmp[1] = true
        })

        await web3.personal.unlockAccount(ethAddresses[2], '')
        await receiverInstance
            .setWeiPerMinToken(init.receiverSetting.weiPerMinToken * 2, { from: ethAddresses[2] })
            .catch(err => {
                tmp[2] = true
            })
        const ideal = [true, true, true]
        const result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('(Transfer..) Receiver', async () => {
        const tmp = []
        const svalue = 100 * 10 ** init.tokenSetting.decimals

        tmp.push(parseInt((await tokenInstance.balanceOf(receiverInstance.address)).valueOf()))
        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[1])).valueOf()))

        const transferReceiver = await receiverInstance.transfer(ethAddresses[1], svalue, { from: ethAddresses[0] })

        tmp.push(transferReceiver['logs'][0]['args']['_newtokens'])
        tmp.push(transferReceiver['logs'][1]['args']['_newtokens'])

        tmp.push(parseInt((await tokenInstance.balanceOf(receiverInstance.address)).valueOf()))
        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[1])).valueOf()))

        const ideal = [tmp[0], tmp[1], svalue, svalue, tmp[0] - svalue, tmp[1] + svalue]
        const result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal,true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('(Working Receiver) Buying token...', async () => {
        let tmpCommon = []
        const idealCommon = []
        const svalue = 0.01
        const mantiss = 1000000000000000000
        for (let j = 0; j < 2; j++) {
            for (let i = 0; i < ethAddresses.length; i++) {
                const tmp = []
                const ideal = []
                tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i])).valueOf())
                await web3.personal.unlockAccount(ethAddresses[i], '')

                await receiverInstance.sendTransaction({
                    from: ethAddresses[i],
                    value: web3.toWei(svalue * (i + 1), 'ether'),
                })

                tmp.push((await receiverInstance.calculateTokenCount(web3.toWei(svalue * (i + 1), 'ether'))).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i])).valueOf())
                tmp.push((await tokenInstance.balanceOf(accounts[0])).valueOf())
                tmp.push((await receiverInstance.weiPerMinToken()).valueOf())

                let floorTmp = new BigNumber(svalue * (i + 1))
                    .mul(mantiss)
                    .div(tmp[5])
                    .floor()

                ideal.push(tmp[0], tmp[1], floorTmp, new BigNumber(tmp[1]).add(floorTmp), tmp[4], tmp[5])
                idealCommon.push(...ideal)
                tmpCommon = tmpCommon.concat(tmp)
            }
        }

        const result = utils.validateValues(tmpCommon, idealCommon)
        console.log(utils.tableEqual(tmpCommon, idealCommon, true))
        assert.equal(result, idealCommon.length, ' only few tests were passed :c')
    })
    it('(Working Receiver) Buying token... [stress-test]', async () => {
        const tmp = []
        const svalue = 1000500000000

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[2])).valueOf())
        await receiverInstance
            .sendTransaction({ from: ethAddresses[3], value: web3.toWei(svalue, 'ether') })
            .catch(err => {
                tmp.push(true)
            })

        tmp.push((await tokenInstance.balanceOf(ethAddresses[2])).valueOf())
        const ideal = [tmp[0], tmp[1], true, tmp[1]]
        const result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('(Finished receiver no withdraw)', async () => {
        const tmp = []
        const svalue = 0.01
        const tokenValue = 1000 * 10 ** tokenSetting.decimals
        //Try transfer, return exception
        tmp.push((await fakeReceiverInstance.isSelling()).valueOf())
        await fakeReceiverInstance.transfer(ethAddresses[0], tokenValue, { from: ethAddresses[0] }).catch(err => {
            tmp.push(true)
        })
        //Try withdraw, return exception
        await fakeReceiverInstance.withdraw({ from: ethAddresses[3] }).catch(err => {
            tmp.push(true)
        })
        //Try buy, return exception
        await fakeReceiverInstance
            .sendTransaction({ from: ethAddresses[3], value: web3.toWei(svalue, 'ether') })
            .catch(err => {
                tmp.push(true)
            })

        const ideal = [false,true, true,true]
        const result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
})
