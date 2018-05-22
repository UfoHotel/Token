const validateValues = (test, ideal) => {
    let result = 0
    let temp = 0

    if (ideal.length === test.length) {
        ideal.forEach(function(element) {
            if (element == test[temp]) {
                result++
            }
            temp++
        }, this)
    }
    return result
}

const tableEqual = (tmp, ideal) => ideal.reduce((acc,key,index) => {
        return [
            ...acc,
            `${ideal[index]} | ${tmp[index]} | ${ideal[index] == tmp[index]}`
        ]
    },[])


const time = (date) => parseInt(date.getTime() / 1000)

module.exports = {
    validateValues,
    tableEqual,
    time,
}