//****************************//
//  Global Vars
//****************************//
var con = new Stardog.Connection();

var svg_width = 1600; //possibly calculated later
var svg_height = 1600; //defaults, should be calculated below

var controller_width = 400;

var control_width = 150;
var control_height = 200;
var control_spacing = 100;
var control_padding = 5;

var controls = {
        people: "",
        organizations: "",
        contacts: "",
        departments: ""
    }

    

var card_width = 150;
var card_height = 200;
var card_spacing = 100;
var card_padding = 5;

var root_uri = "http://code.google.com/p/omiabis-dev/source/browse/branches/CompetencyTest.owl/OMIABIS_0000077";

var left_tree_data = null;
var right_tree_data = null;
var left_tree = null;
var right_tree = null;

//****************************//
//  DB code
//****************************//

//having credentials in JS is a terrible idea.  I blame stardog.  :)
con.setEndpoint("http://localhost:5820");
con.setCredentials("admin", "admin");
con.setReasoning("RDFS");


con.query({
        database: "cafe",
        query: "select ?target ?label ?parent ?parent_label where { ?target <http://purl.obolibrary.org/obo/OBI_0000846> <" + root_uri + "> . ?target rdfs:label ?label . ?target <http://purl.obolibrary.org/obo/OBI_0000846> ?parent . ?parent rdfs:label ?parent_label}", //string building queries; also terrible, but don't see other option in stardog.js
    },
    function (returned) {
        var results = returned.results.bindings
        
        var data = build_tree_model(results, root_uri)

        //temporary until we need to display two different trees
        left_tree_data = data
        right_tree_data = data
        
        build_tree(left_tree_data, "#left-tree")
        build_tree(right_tree_data, "#right-tree")
    })

function build_tree_model(results, root_uri) {
    
    //initial setup
    var model = new Object();

    var lookup = {};

    

    var root_label;

    for(i in results){
        r = results[i];

        //gathering the parents 
        parents = []
        for(k in results){
            p = results[k]

            if(p.target.value === r.target.value){
                parents.push(p.parent.value)
            }

            if(p.parent.value === root_uri){
                root_label = p.parent_label.value
            }
        }

        lookup[r.target.value] = {"name" : r.label.value, "uri": r.target.value, "parents" : parents}
    }

    model.name = root_label;
    model.uri = root_uri;
    model.children = []

    lookup[model.uri] = model


    for(i in lookup){
        item = lookup[i];

        var parents = []

        for(j in item.parents){
            parents.push(lookup[item.parents[j]])
        }

        item.parents = parents


        for(j in item.parents){

            parent = item.parents[j]
            if(typeof parent.children === 'undefined'){
                parent.children = []
                parent.children.push(item)
            } else {
                parent.children.push(item)
            }
        }
    }

    for(i in lookup){
        item = lookup[i];
        for(j in item.children){
            for(k in item.parents){
                for(l in item.parents[k].children){
                    child = item.children[j];
                    parent_child = item.parents[k].children[l]
                    
                    if(child.uri === parent_child.uri){
                        
                        item.parents[k].children.splice(item.parents[k].children.indexOf(parent_child), 1)
                        
                        break

                    }
                }
            }
        }
    }

    //calculating svg size needed
    svg_height = get_depth(model, 1) * (card_height + card_spacing)


    return model
}

function get_depth(model, depth){
    if(typeof model.children === 'undefined'){
        return depth
    }

    var new_depth = depth

    for(key in model.children){
        child_depth = get_depth(model.children[key], depth + 1) 
        if(new_depth < child_depth){
            new_depth = child_depth
        }
    }

    return new_depth
}

//****************************//
//  binding the buttons
//****************************//


//depends on other things loading first, so wait until the page is loaded
$(function() {
    $("#people").click(function(){
        con.query({
            database: "cafe",
            query: "select distinct ?s where { ?s rdf:type <http://purl.obolibrary.org/obo/NCBITaxon_9606> }", 
        },
        function (people) {
            var results = people.results.bindings
            var uris = new Array()

            for(key in results){
                uris.push(results[key].s.value)
            }

            highlight_nodes(uris)

            clear_trees()

            build_tree(left_tree_data, "#left-tree")
            build_tree(right_tree_data, "#right-tree")
        })

    })

    $("#orgs").click(function(){
        con.query({
            database: "cafe",
            query: "select distinct ?s where { ?s rdf:type <http://purl.obolibrary.org/obo/OBI_0000245> }", 
        },
        function (orgs) {
            var results = orgs.results.bindings
            var uris = new Array()

            for(key in results){
                uris.push(results[key].s.value)
            }

            highlight_nodes(uris)

            clear_trees()

            build_tree(left_tree_data, "#left-tree")
            build_tree(right_tree_data, "#right-tree")
        })

    })

    $("#contacts").click(function(){
        con.query({
            database: "cafe",
            query: "select distinct ?s where { ?s rdf:type <http://purl.obolibrary.org/obo/OMIABIS_0000013> }", 
        },
        function (contacts) {
            var results = contacts.results.bindings
            var uris = new Array()

            for(key in results){
                uris.push(results[key].s.value)
            }

            highlight_nodes(uris)

            clear_trees()

            build_tree(left_tree_data, "#left-tree")
            build_tree(right_tree_data, "#right-tree")
        })

    })

    $("#depts").click(function(){
        con.query({
            database: "cafe",
            query: "select distinct ?s where { ?s rdf:type <http://purl.obolibrary.org/obo/OMIABIS_0000017> }", 
        },
        function (depts) {
            var results = depts.results.bindings
            var uris = new Array()

            for(key in results){
                uris.push(results[key].s.value)
            }

            highlight_nodes(uris)

            clear_trees()

            build_tree(left_tree_data, "#left-tree")
            build_tree(right_tree_data, "#right-tree")
        })

    })

})

function highlight_nodes(uris){
    //no data in the trees yet, abort!
    if(left_tree_data === null || right_tree_data === null){
        return
    }

    unhighlight_nodes()

    function recursive_traversal(tree){
        for(key in uris){
            uri = uris[key]
            if(uri === tree.uri){
                console.log("FOUND MATCH")
                tree.highlight = true
            } 
        }

        if(typeof tree.children === "undefined" || tree.children.length < 1){
            return
        } else {
            for(key in tree.children){
                recursive_traversal(tree.children[key])
            }
        }
    }

    recursive_traversal(left_tree_data)
    recursive_traversal(right_tree_data)

}

function unhighlight_nodes(){
    //no data in the trees yet, abort!
    if(left_tree_data === null || right_tree_data === null){
        return
    }

    function recursive_traversal(tree){
        tree.highlight = false

        if(typeof tree.children === "undefined" || tree.children.length < 1){
            return
        } else {
            for(key in tree.children){
                recursive_traversal(tree.children[key])
            }
        }
    }

    recursive_traversal(left_tree_data)
    recursive_traversal(right_tree_data)

}

function clear_trees(){
    $("#left-tree").empty()
    $("#right-tree").empty()
}


//****************************//
//  visualization code
//****************************//

function build_tree(data, container) {   	


    //Create SVG element
    var svg = d3.select(container)
        .append("svg")
        .attr("width", svg_width)
        .attr("height", svg_height)
        .append("g")
        .attr("transform", "translate(" + card_width / 2 + ", " + card_height / 2 + ")")

    var tree = d3.layout.tree()
        .size([svg_width - card_width, svg_height - card_height])

    var diagonal = d3.svg.diagonal()
        .source(function(d) { return {"x": d.source.x, "y": d.source.y + (card_height / 2) - card_padding}})
        .target(function(d) { return {"x": d.target.x, "y": d.target.y - (card_height / 2) + card_padding}})
        .projection(function(d) { return [d.x, d.y]; });
		

    var nodes = tree.nodes(data);
    var links = tree.links(nodes);

    var link = svg.selectAll(".link")
        .data(links)
        .enter().append("path")
        .attr("class", "link")
        .attr("d", diagonal);

    var node = svg.selectAll(".node")
        .data(nodes)
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", function(d) { 
            return "translate(" + d.x + ", " + d.y + ")"; 
        })

    build_node(node);

    d3.select(self.frameElement).style("height", svg_height + "px")

}


function build_node(node) {

    var card_div = node.append("foreignObject")
        .attr('width', card_width)
        .attr('height', card_height)
        .attr("x", card_width / -2)
        .attr("y", card_height / -2)
        .attr("style", "padding: " + card_padding + "px")
        .append('xhtml:div')
        .attr("class", function(d) {
            console.log(d)
            if(d.highlight === false || typeof d.highlight === "undefined" ) {
                console.log(d.highlight === true)
                return "panel panel-primary"
            } else if (d.highlight === true ) {
                console.log("highlighting!")
                return "panel panel-danger"
            }
        })



    card_div.append('xhtml:div') //header div
        .attr("class", "panel-heading")
        .append('xhtml:p')
        .text(function(d) { return d.name})
        .attr("style", "font-size: 12px ; text-align: center")
        .attr("class", "panel-title")

    card_div.append('xhtml:div')
        .attr("class", "panel-body")
        .append("xhtml:p")
        .attr("style", "font-size: 10px")
        .text(function(d) { return "" })

    card_div.attr("style", "height: " + (card_height - card_padding) + "px")


}