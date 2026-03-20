package com.devmind.springbackend.model;

import org.springframework.data.neo4j.core.schema.GeneratedValue;
import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;
import java.util.HashSet;
import java.util.Set;

@Node("CodeNode")
public class CodeNode {
    @Id
    @GeneratedValue
    private Long id;
    
    private String name;
    private String type; // class, method, variable, etc.
    private int startLine;
    private int endLine;

    @Relationship(type = "CALLS")
    private Set<CodeNode> calledNodes = new HashSet<>();

    public CodeNode() {}

    public CodeNode(String name, String type, int startLine, int endLine) {
        this.name = name;
        this.type = type;
        this.startLine = startLine;
        this.endLine = endLine;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public int getStartLine() { return startLine; }
    public void setStartLine(int startLine) { this.startLine = startLine; }
    public int getEndLine() { return endLine; }
    public void setEndLine(int endLine) { this.endLine = endLine; }
    public Set<CodeNode> getCalledNodes() { return calledNodes; }
    public void setCalledNodes(Set<CodeNode> calledNodes) { this.calledNodes = calledNodes; }
}
