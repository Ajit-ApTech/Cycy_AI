package com.devmind.springbackend.model;

import org.springframework.data.neo4j.core.schema.Id;
import org.springframework.data.neo4j.core.schema.Node;
import org.springframework.data.neo4j.core.schema.Relationship;
import java.util.HashSet;
import java.util.Set;

@Node("SourceFile")
public class SourceFile {
    @Id
    private String path;
    private String name;
    private String language;
    private long size;

    @Relationship(type = "CONTAINS")
    private Set<CodeNode> elements = new HashSet<>();

    public SourceFile() {}

    public SourceFile(String path, String name, String language, long size) {
        this.path = path;
        this.name = name;
        this.language = language;
        this.size = size;
    }

    // Getters and Setters
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public long getSize() { return size; }
    public void setSize(long size) { this.size = size; }

    public Set<CodeNode> getElements() { return elements; }
    public void setElements(Set<CodeNode> elements) { this.elements = elements; }
}
