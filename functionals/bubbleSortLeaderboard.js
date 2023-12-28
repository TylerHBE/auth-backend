function bblSortLeaderboard(arr) {
 
    for (var i = 0; i < arr.length; i++) {
 
        // Last i elements are already in place  
        for (var j = 0; j < (arr.length - i - 1); j++) {
 
            // Checking if the item at present iteration 
            // is greater than the next iteration
            if (arr[j].score < arr[j + 1].score) {
 
                // If the condition is true
                // then swap them
                var temp = arr[j]
                arr[j] = arr[j + 1]
                arr[j + 1] = temp
            }
        }

        arr[i].place = i + 1
        if (i > 0) {
            if(arr[i].score===arr[i - 1].score) {
                arr[i].place=arr[i-1].place
            }

        }
    }
 
    // Print the sorted array
    return arr;
}

module.exports = bblSortLeaderboard