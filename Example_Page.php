<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>Inflation example</title>
        <script src="inflation.js"></script>
    </head>

    <body>
        <!-- This is the page HTML -->
        
        <!-- Insert component contents here by inflation -->
        <div id="comp1" inflate="Component"></div>
        
    </body>
    
    <script>
        // Include component file (HTML+CSS+JAVASCRIPT)
        Inflation.include("Example_Component.php");
        
        // This gets called when all included files have been loaded and the page is ready
        Inflation.ready(function() {
            
            // Create component instance and attach to existing (inflated) element
            var comp1 = new Component(document.getElementById("comp1"));
            comp1.setTitle("ONE");
            
            // Create another instance by inflating here and add it to document programmatically
            var comp2 = new Component("Component");
            document.body.appendChild(comp2.elem);
            comp2.setTitle("TWO");
            
        });
    </script>

</html>
