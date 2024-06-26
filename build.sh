file="main.cpp"
output="app" # output name for native executable

if [ "$1" = "release" ]; then
    if [ "$2" = "wasm" ]; then
        echo "release build for wasm target"
        build_command="em++ -O2 $file -o static/main.js"
        
        echo $build_command
        $build_command && rm "static/main.js" # we only need the .wasm file, not the .js file

    elif [ "$2" = "native" ]; then
        echo "release build for native target"
        build_command="clang++ -std=c++11 -O3 -Wall -Wextra -pedantic $file -o $output"

        echo $build_command
        $build_command && ./$output
    
    else
        echo "Usage: build.sh <release|debug> <native|wasm>"
    fi
elif [ "$1" = "debug" ]; then
    if [ "$2" = "wasm" ]; then
        echo "debug build for wasm target"
        build_command="em++ $file -o static/main.js"

        echo $build_command
        $build_command && rm "static/main.js" # we only need the .wasm file, not the .js file      

    elif [ "$2" = "native" ]; then
        echo "debug build for native target"
        build_command="clang++ -std=c++11 -Wall -Wextra -pedantic -fsanitize=address,undefined $file -o $output"

        echo $build_command
        $build_command && ./$output

    else
        echo "Usage: build.sh <release|debug> <native|wasm>"
    fi
else
    echo "Usage: build.sh <release|debug> <native|wasm>"
fi
