pragma solidity ^0.4.24;

import "./SafeMath.sol";
import "./UHCToken.sol";
//Not complete
contract MainLogic {
    using SafeMath for uint256;

    uint256 houseCount = 120;
    uint256 roomCount = 100;

    struct Week{
        //Владелец недели, если нет то 0x0
        address owner;
        //Красная ли неделя
        bool isRed;
    }
    //120 домов [кол-во комнат (тест 100 комнат)] по 25 лет * 52 недели
    Week[120][100][25 * 52] public houses;

    struct Account{
        //Флаг инициализации аккаунта
        bool isInit;
        //Кол-во покупок в текущем году
        uint256 currentWeekCount;
        //Текущий год покупок, при покупке сверяем года и обновляем по надобности
        uint16 currentYear;
    }

    mapping(address => Account) accounts;

    struct statusConstant{
        uint256 maxWeekYear;
        uint256 minPeriod;
        uint256 maxPeriod;
    }

    //Дата отсчета(для недель)??
    uint256 public startDate;
    //Текущий год, нужно обновлять(Как вычислить год unix?)
    uint16 public currentYear;
    //Стандартная цена недели
    uint256 public standartCost;
    //Красная цена недели
    uint256 public redCost;
    //Регистрационный сбор
    uint256 public regFee;

    UHCToken private tokenInstance;

    event EvBuyPeriod(address owner,uint256 house, uint256 room, uint256 weekStart, uint256 weekCount);

    constructor (address token) public {
        tokenInstance = UHCToken(token);
    }
    /*
    function buyWeeks(uint256 house, uint256 room, uint256 weekStart,uint256 weekCount) external {
        address buyer = msg.sender;
        //Проверяем был ли инициализирован пользователь, если нет то инициализируем(кроме diamant)
        //tryInit(buyer);
        //Проверяем не наступил ли новый год, если да, то обнуляем счетчик недель
        tryUpdate(buyer);
        require(accounts[buyer].isInit);
        require(accounts[buyer].maxWeekYear.sub(accounts[buyer].currentWeekCount) <= weekCount);
        require(isPeriodOpen(house, room, weekStart, weekCount));
        uint256 commonCost = regFee;
        for(uint256 i = weekStart; i < weekStart + weekCount; i++){
            require(houses[house][room][i].owner == 0x0);
            houses[house][room][i].owner = msg.sender;
            commonCost += houses[house][room][i].isRed ? redCost : standartCost;
        }
        require(tokenInstance.transfer(msg.sender, tokenInstance.owner, commonCost));
        EvBuyPeriod(msg.sender, house, room, weekStart, weekCount);
    }
*/
    function tryUpdate(address owner) internal{
        if(!accounts[owner].isInit || accounts[owner].currentYear == currentYear){
            return;
        }
        accounts[owner].currentYear = currentYear;
        accounts[owner].currentWeekCount = 0;
    }

    function isPeriodOpen(uint256 house, uint256 room,uint256 weekStart, uint256 weekCount) internal view returns(bool) {
        for(uint256 i = weekStart; i < weekStart + weekCount; i++){
            if(houses[house][room][i].owner != 0x0){
                return false;
            }
        }
        return true;
    }
}
