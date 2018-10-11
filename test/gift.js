const init = require('./init')
const utils = require('./utils')
const BigNumber = require('bignumber.js')

const MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
const ethAddresses = []
const tokenSetting = init.tokenSetting
const receiverSetting = init.receiverSetting
let tokenInstance
let receiverInstance

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

        tokenInstance = await utils.createTx(init, 'initToken', [ethAddresses[0]])

        tmp.push((await tokenInstance.balanceOf(ethAddresses[0])).valueOf())
        tmp.push((await tokenInstance.decimals()).valueOf())
        tmp.push((await tokenInstance.name()).valueOf())
        tmp.push((await tokenInstance.symbol()).valueOf())
        tmp.push((await tokenInstance.owner()).valueOf())
        tmp.push((await tokenInstance.transferFeePercent()).valueOf())

        let result = utils.validateValues(tmp, ideal)

        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })
    it('(Init...) Receivers', async () => {
        const tmp = []
        const ideal = []

        receiverInstance = await init.initReceiver(tokenInstance, ethAddresses[0])
        assert.ok(receiverInstance)

        tmp.push(
            (await tokenInstance.serviceGroupChange(receiverInstance.address, 3, {
                from: ethAddresses[0],
            }))['logs'][0]['args']['_newgroup'].valueOf(),
        )
        ideal.push(3)
        tmp.push((await receiverInstance.getGroup.call(ethAddresses[0])).valueOf())
        ideal.push(4)

        tmp.push(await init.distributeTokensToReceiver(tokenInstance, receiverInstance.address, ethAddresses[0]))
        ideal.push(init.receiverSetting.balance)

        let result = utils.validateValues(tmp, ideal)
        console.log(utils.tableEqual(tmp, ideal, true))
        assert.equal(result, ideal.length, ' only few tests were passed :c')
    })

    it('(Working Receiver) Buying token... (no success)', async () => {
        const giftPercent = 10
        await utils.createTx(receiverInstance, 'serviceActivateGift', [giftPercent])
        let tmpCommon = []
        const idealCommon = []
        const svalue = 0.5
        const mantiss = 1000000000000000000
        const accounts = ethAddresses.reduce(
            (acc, item) => ({
                ...acc,
                [item]: {
                    allToken: new BigNumber(0),
                    version: new BigNumber(1),
                    versionRefererTokens: new BigNumber(1),
                },
            }),
            {},
        )
        for (let j = 0; j < 2; j++) {
            for (let i = 1; i < ethAddresses.length; i++) {
                const tmp = []
                const ideal = []
                const ethValue = svalue * (i + 1)
                const hex = '0x01234' + i

                await tokenInstance.serviceSetPromo(hex, ethAddresses[i - 1], {
                    from: ethAddresses[0],
                })
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i - 1])).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i])).valueOf())
                await web3.personal.unlockAccount(ethAddresses[i], '')

                await utils.createTx(receiverInstance, 'sendTransaction', [
                    {
                        from: ethAddresses[i],
                        value: web3.toWei(ethValue, 'ether'),
                        data: '0x01234' + i,
                    },
                ])

                tmp.push((await receiverInstance.calculateTokenCount(web3.toWei(ethValue, 'ether'))).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i])).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i - 1])).valueOf())
                tmp.push((await receiverInstance.weiPerMinToken()).valueOf())

                const floorTmp = new BigNumber(ethValue)
                    .multipliedBy(mantiss)
                    .div(tmp[5])
                    .integerValue(BigNumber.ROUND_FLOOR)

                let referalBalance = new BigNumber(tmp[1]).plus(floorTmp)
                let refererBalance = new BigNumber(tmp[0])

                const referalFee = floorTmp
                    .div(100)
                    .integerValue(BigNumber.ROUND_FLOOR)
                    .multipliedBy(receiverSetting.referalBonus)
                    .integerValue(BigNumber.ROUND_FLOOR)
                const refererFee = floorTmp
                    .div(100)
                    .integerValue(BigNumber.ROUND_FLOOR)
                    .multipliedBy(receiverSetting.refererBonus)
                    .integerValue(BigNumber.ROUND_FLOOR)
                referalBalance = referalBalance.plus(referalFee)
                if (i - 1 !== 0) {
                    refererBalance = refererBalance.plus(refererFee)
                } else {
                    refererBalance = tmp[4]
                }

                const giftFee = floorTmp
                    .div(100)
                    .integerValue(BigNumber.ROUND_FLOOR)
                    .multipliedBy(giftPercent)
                    .integerValue(BigNumber.ROUND_FLOOR)

                referalBalance = referalBalance.plus(giftFee)

                accounts[ethAddresses[i]].allToken = accounts[ethAddresses[i]].allToken
                    .plus(giftFee)
                    .plus(referalFee)
                    .plus(floorTmp)
                accounts[ethAddresses[i]].version = accounts[ethAddresses[i]].version.plus(floorTmp)
                accounts[ethAddresses[i]].versionRefererTokens = accounts[ethAddresses[i]].versionRefererTokens.plus(
                    refererFee,
                )

                const accountInfo = (await receiverInstance.accounts(ethAddresses[i])).map(item => item.valueOf())
                tmp.push(...accountInfo)
                ideal.push(tmp[0], tmp[1], floorTmp, referalBalance, refererBalance, tmp[5])

                const { allToken, version, versionRefererTokens } = accounts[
                    ethAddresses[i]
                ]
                //push account info calc
                ideal.push(
                    accountInfo[0],
                    allToken,
                    version.minus(1),
                    0,
                    allToken.plus(1),
                    version,
                    versionRefererTokens,
                    0,
                )
                idealCommon.push(...ideal)
                tmpCommon = tmpCommon.concat(tmp)
            }
        }

        const result = utils.validateValues(tmpCommon, idealCommon)
        console.log(utils.tableEqual(tmpCommon, idealCommon, true))
        assert.equal(result, idealCommon.length, ' only few tests were passed :c')
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
            (await receiverInstance.activateVersion(!(await receiverInstance.isActive()).valueOf(), {
                from: ethAddresses[0],
            }))['logs'][0]['args']['_isActivate'].valueOf(),
        )
        tmpCommon.push((await receiverInstance.isSelling()).valueOf())
        await receiverInstance
            .refresh(
                init.receiverSetting.startTime,
                init.receiverSetting.softCap,
                init.receiverSetting.durationOfStatusSell,
                init.receiverSetting.statusMinBorders,
                init.receiverSetting.referalBonus,
                init.receiverSetting.refererBonus,
                init.receiverSetting.maxRefundStageTime,
                true,
                { from: ethAddresses[0] },
            )
            .catch(e => {
                tmpCommon.push(true)
            })
        await receiverInstance.withdraw({ from: ethAddresses[0] }).catch(e => {
            tmpCommon.push(true)
        })
        idealCommon.push(true, false, false, true, true)

        for (let i = 1; i < ethAddresses.length; i++) {
            const tmp = []
            //Try transfer, return exception
            await receiverInstance.transfer(ethAddresses[i], tokenValue, { from: ethAddresses[0] }).catch(err => {
                tmp.push(true)
            })
            await receiverInstance
                .sendTransaction({
                    from: ethAddresses[i],
                    value: web3.toWei(svalue, 'ether'),
                })
                .catch(err => {
                    tmp.push(true)
                })
            //Try refund
            const referalBalance= (await tokenInstance.balanceOf(ethAddresses[i - 1])).valueOf()
            const accInfo = await receiverInstance.accounts(ethAddresses[i])
            const cap = (await receiverInstance.softcap()).valueOf()
            const totalSold = (await receiverInstance.soldOnVersion(0)).valueOf()
            const tokenBalanceBeforeRefund = (await tokenInstance.balanceOf(ethAddresses[i])).valueOf()
            const referer = (await tokenInstance.refererOf(ethAddresses[i])).valueOf()
            const refererBalanceBeforeRefund = (await tokenInstance.balanceOf(referer)).valueOf()
            const statusBeforeRefund = (await tokenInstance.statusOf(ethAddresses[i])).valueOf()
            tmp.push(!tmpCommon[1] && cap - totalSold > 0 && accInfo[0].gt(0))
            tmp.push(
                (await receiverInstance.refund({ from: ethAddresses[i] }))['logs'][0]['args']['_spent'].valueOf() - 1,
            )
            //Проверка отката баланса
            const tokenBalanceAfterRefund = (await tokenInstance.balanceOf(ethAddresses[i])).valueOf()
            tmp.push(tokenBalanceBeforeRefund - tokenBalanceAfterRefund)
            const refererBalanceAfterRefund = (await tokenInstance.balanceOf(referer)).valueOf()
            tmp.push(
                referer === ethAddresses[0] ? accInfo[6] - 1 : refererBalanceBeforeRefund - refererBalanceAfterRefund,
            )
            //Проверка отката статуса
            const statusAfterRefund = (await tokenInstance.statusOf(ethAddresses[i])).valueOf()

            tmp.push(statusAfterRefund)
            idealCommon.push(
                true,
                true,
                true,
                accInfo[0],
                accInfo[4] === 0 ? 0 : accInfo[4] - 1,
                accInfo[6] === 0 ? 0 : accInfo[6] - 1,
                accInfo[7],
            )
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
        //success or refund all ether from current version
        const cap = (await receiverInstance.softcap()).valueOf()
        const totalSold = (await receiverInstance.soldOnVersion(0)).valueOf()
        tmp.push(cap - totalSold > 0)

        await receiverInstance
            .refresh(
                init.receiverSetting.startTime,
                init.receiverSetting.softCap,
                init.receiverSetting.durationOfStatusSell,
                init.receiverSetting.statusMinBorders,
                init.receiverSetting.referalBonus,
                init.receiverSetting.refererBonus,
                init.receiverSetting.maxRefundStageTime,
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
                init.receiverSetting.maxRefundStageTime,
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
    it('(Working Receiver) Buying token... (no success)', async () => {
        const giftPercent = 5
        await utils.createTx(receiverInstance, 'serviceActivateGift', [giftPercent])
        let tmpCommon = []
        const idealCommon = []
        const svalue = 0.5
        const mantiss = 1000000000000000000
        const accounts = ethAddresses.reduce(
            (acc, item) => ({
                ...acc,
                [item]: {
                    allToken: new BigNumber(0),
                    version: new BigNumber(1),
                    versionRefererTokens: new BigNumber(1),
                },
            }),
            {},
        )
        for (let j = 0; j < 1; j++) {
            for (let i = 1; i < ethAddresses.length; i++) {
                const tmp = []
                const ideal = []
                const ethValue = svalue * (i + 1)
                const hex = '0x01234' + i

                await tokenInstance.serviceSetPromo(hex, ethAddresses[i - 1], {
                    from: ethAddresses[0],
                })
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i - 1])).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i])).valueOf())
                await web3.personal.unlockAccount(ethAddresses[i], '')

                await utils.createTx(receiverInstance, 'sendTransaction', [
                    {
                        from: ethAddresses[i],
                        value: web3.toWei(ethValue, 'ether'),
                        data: '0x01234' + i,
                    },
                ])

                tmp.push((await receiverInstance.calculateTokenCount(web3.toWei(ethValue, 'ether'))).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i])).valueOf())
                tmp.push((await tokenInstance.balanceOf(ethAddresses[i - 1])).valueOf())
                tmp.push((await receiverInstance.weiPerMinToken()).valueOf())

                const floorTmp = new BigNumber(ethValue)
                    .multipliedBy(mantiss)
                    .div(tmp[5])
                    .integerValue(BigNumber.ROUND_FLOOR)

                let referalBalance = new BigNumber(tmp[1]).plus(floorTmp)
                let refererBalance = new BigNumber(tmp[0])

                const referalFee = floorTmp
                    .div(100)
                    .integerValue(BigNumber.ROUND_FLOOR)
                    .multipliedBy(receiverSetting.referalBonus)
                    .integerValue(BigNumber.ROUND_FLOOR)
                const refererFee = floorTmp
                    .div(100)
                    .integerValue(BigNumber.ROUND_FLOOR)
                    .multipliedBy(receiverSetting.refererBonus)
                    .integerValue(BigNumber.ROUND_FLOOR)
                referalBalance = referalBalance.plus(referalFee)
                if (i - 1 !== 0) {
                    refererBalance = refererBalance.plus(refererFee)
                } else {
                    refererBalance = tmp[4]
                }

                const giftFee = floorTmp
                    .div(100)
                    .integerValue(BigNumber.ROUND_FLOOR)
                    .multipliedBy(giftPercent)
                    .integerValue(BigNumber.ROUND_FLOOR)

                referalBalance = referalBalance.plus(giftFee)

                accounts[ethAddresses[i]].allToken = accounts[ethAddresses[i]].allToken
                    .plus(giftFee)
                    .plus(referalFee)
                    .plus(floorTmp)
                accounts[ethAddresses[i]].version = accounts[ethAddresses[i]].version.plus(floorTmp)
                accounts[ethAddresses[i]].versionRefererTokens = accounts[ethAddresses[i]].versionRefererTokens.plus(
                    refererFee,
                )

                const accountInfo = (await receiverInstance.accounts(ethAddresses[i])).map(item => item.valueOf())
                tmp.push(...accountInfo)
                ideal.push(tmp[0], tmp[1], floorTmp, referalBalance, refererBalance, tmp[5])

                const { allToken, version, versionRefererTokens } = accounts[
                    ethAddresses[i]
                ]
                //push account info calc
                ideal.push(
                    accountInfo[0],
                    allToken,
                    version.minus(1),
                    1,
                    allToken.plus(1),
                    version,
                    versionRefererTokens,
                    0,
                )
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
            (await receiverInstance.activateVersion(!(await receiverInstance.isActive()).valueOf(), {
                from: ethAddresses[0],
            }))['logs'][0]['args']['_isActivate'].valueOf(),
        )
        tmpCommon.push((await receiverInstance.isSelling()).valueOf())
        idealCommon.push(false, false, false)

        for (let i = 1; i < ethAddresses.length; i++) {
            const tmp = []
            //Try transfer, return exception
            await receiverInstance.transfer(ethAddresses[i], tokenValue, { from: ethAddresses[0] }).catch(err => {
                tmp.push(1)
            })
            await receiverInstance
                .sendTransaction({
                    from: ethAddresses[i],
                    value: web3.toWei(svalue, 'ether'),
                })
                .catch(err => {
                    tmp.push(2)
                })
            //Try refund
            const accInfo = await receiverInstance.accounts(ethAddresses[i])
            const cap = (await receiverInstance.softcap()).valueOf()
            const totalSold = (await receiverInstance.soldOnVersion(version)).valueOf()

            tmp.push(!tmpCommon[1] && totalSold >= cap && accInfo[version].gt(0))

            await receiverInstance.refund({ from: ethAddresses[i] }).catch(e => {
                tmp.push(3)
            })
            idealCommon.push(1, 2, true, 3)
            tmpCommon = tmpCommon.concat(tmp)
        }
        //Get ether
        await receiverInstance.withdraw({ from: ethAddresses[0] })
        tmpCommon.push(await web3.eth.getBalance(receiverInstance.address))
        idealCommon.push(0)
        const result = utils.validateValues(tmpCommon, idealCommon)
        console.log(utils.tableEqual(tmpCommon, idealCommon, true))
        assert.equal(result, idealCommon.length, ' only few tests were passed :c')
    })
})
