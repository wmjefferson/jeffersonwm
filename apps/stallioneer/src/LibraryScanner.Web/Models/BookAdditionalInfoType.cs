namespace LibraryScanner.Web.Models;

public static class BookAdditionalInfoType
{
    public const string Text = "Text";
    public const string Description = "Description";
    public const string Summary = "Summary";
    public const string Synopsis = "Synopsis";
    public const string Review = "Review";
    public const string Quote = "Quote";
    public const string Link = "Link";
    public const string ExternalLink = "ExternalLink";
    public const string RelatedTitle = "RelatedTitle";
    public const string RelatedAuthor = "RelatedAuthor";
    public const string Reference = "Reference";
    public const string SeriesNote = "SeriesNote";
    public const string EditionNote = "EditionNote";
    public const string Translator = "Translator";
    public const string Illustrator = "Illustrator";
    public const string Editor = "Editor";
    public const string Character = "Character";
    public const string Setting = "Setting";
    public const string Theme = "Theme";
    public const string Award = "Award";
    public const string Adaptation = "Adaptation";
    public const string Provenance = "Provenance";
    public const string Inscription = "Inscription";
    public const string PurchaseNote = "PurchaseNote";
    public const string LoanNote = "LoanNote";
    public const string SaleNote = "SaleNote";
    public const string DisposalNote = "DisposalNote";
    public const string ResearchNote = "ResearchNote";
    public const string Identifier = "Identifier";
    public const string ArchiveLocation = "ArchiveLocation";
    public const string Person = "Person";
    public const string Organization = "Organization";
    public const string ExhibitNote = "ExhibitNote";
    public const string ContentWarning = "ContentWarning";
    public const string Keyword = "Keyword";

    public static IReadOnlyList<BookAdditionalInfoOption> Options { get; } =
    [
        new(Description, "Description"),
        new(Summary, "Summary"),
        new(Synopsis, "Synopsis"),
        new(Text, "Text note"),
        new(Review, "Review"),
        new(Quote, "Quote"),
        new(Link, "Link"),
        new(ExternalLink, "External link"),
        new(RelatedTitle, "Related title"),
        new(RelatedAuthor, "Related author"),
        new(Reference, "Reference"),
        new(SeriesNote, "Series note"),
        new(EditionNote, "Edition note"),
        new(Translator, "Translator"),
        new(Illustrator, "Illustrator"),
        new(Editor, "Editor"),
        new(Character, "Character"),
        new(Setting, "Setting"),
        new(Theme, "Theme"),
        new(Award, "Award"),
        new(Adaptation, "Adaptation"),
        new(Provenance, "Provenance"),
        new(Inscription, "Inscription"),
        new(PurchaseNote, "Purchase note"),
        new(LoanNote, "Loan note"),
        new(SaleNote, "Sale note"),
        new(DisposalNote, "Disposal note"),
        new(ResearchNote, "Research note"),
        new(Identifier, "Identifier"),
        new(ArchiveLocation, "Archive location"),
        new(Person, "Person"),
        new(Organization, "Organization"),
        new(ExhibitNote, "Exhibit note"),
        new(ContentWarning, "Content warning"),
        new(Keyword, "Keyword")
    ];
}
