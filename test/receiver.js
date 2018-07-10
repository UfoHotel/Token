const init = require('./init')
const utils = require('./utils')
const BigNumber = require('bignumber.js')

const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
const ethAddresses = []
const tokenSetting = init.tokenSetting
const receiverSetting = init.receiverSetting
let tokenInstance
let receiverInstance
let fakeReceiverInstance

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

        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[1])).valueOf()))
        tmp.push(parseInt((await tokenInstance.balanceOf(receiverInstance.address)).valueOf()))

        const transferReceiver = await receiverInstance.transfer(ethAddresses[1], svalue, { from: ethAddresses[0] })

        tmp.push(transferReceiver['logs'][0]['args']['_newtokens'])
        tmp.push(transferReceiver['logs'][1]['args']['_newtokens'])

        tmp.push(parseInt((await tokenInstance.balanceOf(ethAddresses[1])).valueOf()))
        tmp.push(parseInt((await tokenInstance.balanceOf(receiverInstance.address)).valueOf()))

        const ideal = [tmp[0], tmp[1], svalue, svalue, tmp[0] + svalue, tmp[1] - svalue]
        const result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('(Working Receiver) Buying token... (no success)', async () => {
        let tmpCommon = []
        const idealCommon = []
        const svalue = 0.5
        const mantiss = 1000000000000000000
        for (let j = 0; j < 2; j++) {
            for (let i = 0; i < ethAddresses.length; i++) {
                const tmp = []
                const ideal = []
                if(i !== 0 ) {
                    const hex = '0x01234' + i
                    await tokenInstance.serviceSetPromo(hex, ethAddresses[i - 1], {from: ethAddresses[0]})
                }
                tmp.push((await tokenInstance.balanceOf(ethAddresses[ i === 0 ? 0 : i - 1])).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i])).valueOf())
                await web3.personal.unlockAccount(ethAddresses[i], '')

                const send = await receiverInstance.sendTransaction({
                    from: ethAddresses[i],
                    value: web3.toWei(svalue * (i + 1), 'ether'),
                    data: i === 0 ? '' : '0x01234' + i
                })

                tmp.push((await receiverInstance.calculateTokenCount(web3.toWei(svalue * (i + 1), 'ether'))).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i])).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[ i === 0 ? 0 : i - 1])).valueOf())
                tmp.push((await receiverInstance.weiPerMinToken()).valueOf())

                let floorTmp = new BigNumber(svalue * (i + 1))
                    .multipliedBy(mantiss)
                    .div(tmp[5])
                    .integerValue(BigNumber.ROUND_FLOOR)

                let referalBalance = new BigNumber(tmp[1]).plus(floorTmp)
                let refererBalance = new BigNumber(i === 0 ? tmp[4] : tmp[0])

                if(i !== 0) {
                    const referalFee = floorTmp.div(100).integerValue(BigNumber.ROUND_FLOOR).multipliedBy(receiverSetting.referalBonus).integerValue(BigNumber.ROUND_FLOOR)
                    const refererFee = floorTmp.div(100).integerValue(BigNumber.ROUND_FLOOR).multipliedBy(receiverSetting.refererBonus).integerValue(BigNumber.ROUND_FLOOR)
                    referalBalance = referalBalance.plus(referalFee)
                    if(i - 1 !== 0) {
                        refererBalance = refererBalance.plus(refererFee)
                    } else {
                        refererBalance = tmp[4]
                    }
                }
                ideal.push(tmp[0], tmp[1], floorTmp, referalBalance, refererBalance, tmp[5])
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
        const correctValue = 0.5

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.balanceOf(ethAddresses[2])).valueOf())

        await receiverInstance
            .sendTransaction({ from: ethAddresses[3], value: web3.toWei(svalue, 'ether') })
            .catch(err => {
                tmp.push(true)
            })

        await receiverInstance
            .sendTransaction({ from: ethAddresses[0], value: web3.toWei(correctValue, 'ether'), data: ethAddresses[0] })
            .catch(err => {
                tmp.push(true)
            })

        tmp.push((await tokenInstance.balanceOf(ethAddresses[2])).valueOf())
        const ideal = [tmp[0], tmp[1], true, true, tmp[1]]
        const result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('(Working Receiver) Finilized receiver (no success)', async () => {
        let tmpCommon = []
        const idealCommon = []
        const tokenValue = 1000 * 10 ** tokenSetting.decimals
        const svalue = 0.01
        //Check active
        tmpCommon.push((await receiverInstance.isSelling()).valueOf())
        //Switch active status
        tmpCommon.push(
            (await receiverInstance.switchActivate({ from: ethAddresses[0] }))['logs'][0]['args'][
                '_isActivate'
            ].valueOf(),
        )
        tmpCommon.push((await receiverInstance.isSelling()).valueOf())
        await receiverInstance
            .refresh(
                init.receiverSetting.startTime,
                init.receiverSetting.softCap,
                init.receiverSetting.durationOfStatusSell,
                init.receiverSetting.statusMinBorders,
                true,
                { from: ethAddresses[0] },
            )
            .catch(e => {
                tmpCommon.push(true)
            })
        await receiverInstance.getWei({ from: ethAddresses[0] }).catch(e => {
            tmpCommon.push(true)
        })
        idealCommon.push(true, false, false, true, true)

        for (let i = 0; i < ethAddresses.length; i++) {
            const tmp = []
            //Try transfer, return exception
            await receiverInstance.transfer(ethAddresses[i], tokenValue, { from: ethAddresses[0] }).catch(err => {
                tmp.push(true)
            })
            await receiverInstance
                .sendTransaction({ from: ethAddresses[i], value: web3.toWei(svalue, 'ether') })
                .catch(err => {
                    tmp.push(true)
                })
            //Try withdraw
            const accInfo = await receiverInstance.accounts(ethAddresses[i])
            const cap = (await receiverInstance.softcap()).valueOf()
            const totalSold = (await receiverInstance.soldOnVersion(0)).valueOf()

            tmp.push(!tmpCommon[1] && totalSold < cap && accInfo[0].gt(0))
            tmp.push(
                (await receiverInstance.withdraw({ from: ethAddresses[i] }))['logs'][0]['args']['_spent'].valueOf(),
            )

            idealCommon.push(true, true, true, accInfo[0])
            tmpCommon = tmpCommon.concat(tmp)
        }

        const result = utils.validateValues(tmpCommon, idealCommon)
        console.log(utils.tableEqual(tmpCommon, idealCommon, true))
        assert.equal(result, idealCommon.length, ' only few tests were passed :c')
    })
    it('(Working Receiver) Refresh contract', async () => {
        const tmp = []
        //Check conditions for refresh
        //no active
        tmp.push((await receiverInstance.isActive()).valueOf())
        //success or withdraw all ether from current version
        const cap = (await receiverInstance.softcap()).valueOf()
        const totalSold = (await receiverInstance.soldOnVersion(0)).valueOf()
        tmp.push(totalSold < cap)

        await receiverInstance
            .refresh(
                init.receiverSetting.startTime,
                init.receiverSetting.softCap,
                init.receiverSetting.durationOfStatusSell,
                init.receiverSetting.statusMinBorders,
                init.receiverSetting.referalBonus,
                init.receiverSetting.refererBonus,
                true,
                { from: ethAddresses[1] },
            )
            .catch(e => {
                tmp.push(true)
            })

        tmp.push(
            (await receiverInstance.refresh(
                init.receiverSetting.startTime,
                init.receiverSetting.softCap,
                init.receiverSetting.durationOfStatusSell,
                init.receiverSetting.statusMinBorders,
                init.receiverSetting.referalBonus,
                init.receiverSetting.refererBonus,
                true,
                { from: ethAddresses[0] },
            ))['logs'][0]['args']['_version'].valueOf(),
        )
        const ideal = [false, true, true, 1]
        const result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    //sell all tokens
    it('(Working Receiver) Buying token... (success)', async () => {
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
                tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
                tmp.push((await receiverInstance.weiPerMinToken()).valueOf())

                let floorTmp = new BigNumber(svalue * (i + 1))
                    .multipliedBy(mantiss)
                    .div(tmp[5])
                    .integerValue(BigNumber.ROUND_FLOOR)

                ideal.push(tmp[0], tmp[1], floorTmp, new BigNumber(tmp[1]).plus(floorTmp), tmp[4], tmp[5])
                idealCommon.push(...ideal)
                tmpCommon = tmpCommon.concat(tmp)
            }
        }
        const restTokens = parseInt((await tokenInstance.balanceOf(receiverInstance.address)).valueOf())
        const transferReceiver = await receiverInstance.transfer(ethAddresses[1], restTokens, { from: ethAddresses[0] })
        tmpCommon.push((await tokenInstance.balanceOf(receiverInstance.address)).valueOf())
        idealCommon.push(0)
        const result = utils.validateValues(tmpCommon, idealCommon)
        console.log(utils.tableEqual(tmpCommon, idealCommon, true))
        assert.equal(result, idealCommon.length, ' only few tests were passed :c')
    })

    it('(Working Receiver) Finilized receiver (success)', async () => {
        let tmpCommon = []
        const idealCommon = []
        const tokenValue = 1000 * 10 ** tokenSetting.decimals
        const svalue = 0.01
        const version = (await receiverInstance.version()).valueOf()
        //Check active
        tmpCommon.push((await receiverInstance.isSelling()).valueOf())
        //Switch active status
        tmpCommon.push(
            (await receiverInstance.switchActivate({ from: ethAddresses[0] }))['logs'][0]['args'][
                '_isActivate'
            ].valueOf(),
        )
        tmpCommon.push((await receiverInstance.isSelling()).valueOf())
        idealCommon.push(false, false, false)

        for (let i = 0; i < ethAddresses.length; i++) {
            const tmp = []
            //Try transfer, return exception
            await receiverInstance.transfer(ethAddresses[i], tokenValue, { from: ethAddresses[0] }).catch(err => {
                tmp.push(1)
            })
            await receiverInstance
                .sendTransaction({ from: ethAddresses[i], value: web3.toWei(svalue, 'ether') })
                .catch(err => {
                    tmp.push(2)
                })
            //Try withdraw
            const accInfo = await receiverInstance.accounts(ethAddresses[i])
            const cap = (await receiverInstance.softcap()).valueOf()
            const totalSold = (await receiverInstance.soldOnVersion(version)).valueOf()

            tmp.push(!tmpCommon[1] && totalSold >= cap && accInfo[version].gt(0))

            await receiverInstance.withdraw({ from: ethAddresses[i] }).catch(e => {
                tmp.push(3)
            })
            idealCommon.push(1, 2, true, 3)
            tmpCommon = tmpCommon.concat(tmp)
        }
        //Get ether
        await receiverInstance.getWei({ from: ethAddresses[0] })
        tmpCommon.push(await web3.eth.getBalance(receiverInstance.address))
        idealCommon.push(0)
        const result = utils.validateValues(tmpCommon, idealCommon)
        console.log(utils.tableEqual(tmpCommon, idealCommon, true))
        assert.equal(result, idealCommon.length, ' only few tests were passed :c')
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
        tmp.push(
            (await fakeReceiverInstance.refresh(
                init.receiverSetting.startTime,
                init.receiverSetting.softCap,
                init.receiverSetting.durationOfStatusSell,
                init.receiverSetting.statusMinBorders,
                init.receiverSetting.referalBonus,
                init.receiverSetting.refererBonus,
                true,
                { from: ethAddresses[0] },
            ))['logs'][0]['args']['_version'].valueOf(),
        )
        tmp.push((await fakeReceiverInstance.isSelling()).valueOf())

        const ideal = [false, true, true, true, true, true]
        const result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
})
