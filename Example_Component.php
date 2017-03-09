<html>
    <!-- This is the component CSS -->
    <style>
        
        .Component {
            display: inline-block;
            border: 2px solid #bbb;
            border-radius: 10px;
            width: auto;
            margin: 10px;
            padding: 10px;
            font-weight: bold;
            cursor: default;
        }
        .Component:hover {
            background: rgba(0,0,0,0.05);
        }
    
    </style>

    <!-- This is the component HTML -->
    <body name="Component" class="Component">
        <div id="title">Title</div>
    </body>
    
    <!-- This is the component JAVASCRIPT -->
    <script>
        
        // You can include other components that your component uses here
        //Inflation.include("OtherComponent.php");
        
        /** My Component */
        function Component(elem) {
            var that = Inflation.super(this, elem); // always initialize component class like this
            
            // Specify your members,methods,etc here
            
            this.titleElem = this.getElementById("title");
            
            this.setTitle = function(title) {
                that.titleElem.innerHTML = title;
            };
        }
        
    </script>

</html>
